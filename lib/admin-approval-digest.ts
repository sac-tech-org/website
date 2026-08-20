import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { event, eventChangeRequest } from "@/db/schema";
import { sendApprovalReminderEmails } from "@/lib/admin-approval-email";
import { APPROVAL_REMINDER_ROLES } from "@/lib/auth-permissions";
import { isEmailDeliveryEnabled } from "@/lib/email-delivery";

const EVENT_PREVIEW_LIMIT = 10;
const PACIFIC_TIME_ZONE = "America/Los_Angeles";

export interface PendingApprovalDigestEvent {
	id: string;
	title: string;
	createdAt: Date;
	startsAt: Date;
	timezone: string;
}

export interface PendingApprovalDigestData {
	events: PendingApprovalDigestEvent[];
	pendingCount: number;
}

interface ApprovalDigestEnvironment {
	[key: string]: string | undefined;
	URL?: string;
}

interface ApprovalReminderEmailOptions {
	to: string[];
	events: PendingApprovalDigestEvent[];
	pendingCount: number;
	reviewUrl: string;
	digestDate: string;
}

type SendApprovalReminderEmails = (
	options: ApprovalReminderEmailOptions,
) => Promise<unknown>;

interface ApprovalReminderDigestDependencies {
	getPendingEvents: () => Promise<PendingApprovalDigestData>;
	getRecipients: (now: Date) => Promise<string[]>;
	sendEmails: SendApprovalReminderEmails;
}

interface SendPendingEventApprovalDigestOptions {
	dependencies?: Partial<ApprovalReminderDigestDependencies>;
	environment?: ApprovalDigestEnvironment;
	now?: Date;
}

export type PendingEventApprovalDigestResult =
	| { status: "email-disabled" }
	| { status: "no-pending"; pendingCount: 0 }
	| { status: "no-reviewers"; pendingCount: number }
	| {
			status: "sent";
			pendingCount: number;
			recipientCount: number;
	  };

/**
 * Select only the small, non-sensitive event summary needed by the digest.
 * The window count preserves the full queue size while the event preview stays
 * bounded.
 */
export async function getPendingApprovalDigestData(): Promise<PendingApprovalDigestData> {
	const [submissions, changes] = await Promise.all([
		db
			.select({
				id: event.id,
				title: event.title,
				createdAt: event.createdAt,
				startsAt: event.startsAt,
				timezone: event.timezone,
				pendingCount: sql<number>`cast(count(*) over () as integer)`,
			})
			.from(event)
			.where(and(eq(event.status, "pending"), isNull(event.canceledAt)))
			.orderBy(asc(event.createdAt), asc(event.id))
			.limit(EVENT_PREVIEW_LIMIT),
		db
			.select({
				id: eventChangeRequest.id,
				title: eventChangeRequest.title,
				createdAt: eventChangeRequest.createdAt,
				startsAt: eventChangeRequest.startsAt,
				timezone: eventChangeRequest.timezone,
				pendingCount: sql<number>`cast(count(*) over () as integer)`,
			})
			.from(eventChangeRequest)
			.innerJoin(event, eq(eventChangeRequest.eventId, event.id))
			.where(
				and(
					eq(eventChangeRequest.status, "pending"),
					eq(event.status, "approved"),
					isNull(event.canceledAt),
				),
			)
			.orderBy(asc(eventChangeRequest.createdAt), asc(eventChangeRequest.id))
			.limit(EVENT_PREVIEW_LIMIT),
	]);
	const rows = [...submissions, ...changes]
		.sort(
			(left, right) =>
				left.createdAt.getTime() - right.createdAt.getTime() ||
				left.id.localeCompare(right.id),
		)
		.slice(0, EVENT_PREVIEW_LIMIT);

	return {
		events: rows.map(({ id, title, createdAt, startsAt, timezone }) => ({
			id,
			title,
			createdAt,
			startsAt,
			timezone,
		})),
		pendingCount:
			(submissions[0]?.pendingCount ?? 0) + (changes[0]?.pendingCount ?? 0),
	};
}

/**
 * Match Better Auth's comma-separated role semantics. A permanent ban remains
 * active, while a temporary ban stops excluding the account at its expiry.
 */
export async function getApprovalReminderRecipients(
	now: Date = new Date(),
): Promise<string[]> {
	const reminderRolePattern = `^[[:space:]]*(${APPROVAL_REMINDER_ROLES.join("|")})[[:space:]]*$`;
	const hasReminderRole = sql<boolean>`exists (
		select 1
		from unnest(string_to_array(coalesce(${user.role}, ''), ',')) as role_entry(value)
		where role_entry.value ~ ${reminderRolePattern}
	)`;
	const rows = await db
		.select({ email: user.email })
		.from(user)
		.where(
			and(
				eq(user.emailVerified, true),
				hasReminderRole,
				or(
					isNull(user.banned),
					eq(user.banned, false),
					lt(user.banExpires, now),
				),
			),
		)
		.orderBy(asc(user.email));

	return [...new Set(rows.map(({ email }) => email.trim().toLowerCase()))]
		.filter(Boolean)
		.sort();
}

export function getApprovalReviewUrl(
	environment: ApprovalDigestEnvironment = process.env,
): string {
	const value = environment.URL?.trim();

	if (!value || value.includes("\r") || value.includes("\n")) {
		throw new Error("URL must be set to the site's absolute HTTP(S) URL");
	}

	let siteUrl: URL;

	try {
		siteUrl = new URL(value);
	} catch {
		throw new Error("URL must be set to the site's absolute HTTP(S) URL");
	}

	if (
		(siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") ||
		!siteUrl.hostname ||
		siteUrl.username ||
		siteUrl.password
	) {
		throw new Error("URL must be set to the site's absolute HTTP(S) URL");
	}

	return new URL("/admin/events", siteUrl.origin).href;
}

export function getPacificDigestDate(now: Date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		month: "2-digit",
		timeZone: PACIFIC_TIME_ZONE,
		year: "numeric",
	}).formatToParts(now);
	const values = Object.fromEntries(
		parts.map(({ type, value }) => [type, value]),
	);

	return `${values.year}-${values.month}-${values.day}`;
}

export async function sendPendingEventApprovalDigest({
	dependencies,
	environment = process.env,
	now = new Date(),
}: SendPendingEventApprovalDigestOptions = {}): Promise<PendingEventApprovalDigestResult> {
	if (!isEmailDeliveryEnabled(environment)) {
		return { status: "email-disabled" };
	}

	const getPendingEvents =
		dependencies?.getPendingEvents ?? getPendingApprovalDigestData;
	const pending = await getPendingEvents();

	if (pending.pendingCount === 0) {
		return { status: "no-pending", pendingCount: 0 };
	}

	const getRecipients =
		dependencies?.getRecipients ?? getApprovalReminderRecipients;
	const recipients = await getRecipients(now);

	if (recipients.length === 0) {
		return { status: "no-reviewers", pendingCount: pending.pendingCount };
	}

	const sendEmails = dependencies?.sendEmails ?? sendApprovalReminderEmails;

	await sendEmails({
		to: recipients,
		events: pending.events,
		pendingCount: pending.pendingCount,
		reviewUrl: getApprovalReviewUrl(environment),
		digestDate: getPacificDigestDate(now),
	});

	return {
		status: "sent",
		pendingCount: pending.pendingCount,
		recipientCount: recipients.length,
	};
}
