import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { event } from "@/db/schema";
import { sendAdminApprovalEmails } from "@/lib/admin-approval-email";

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

interface AdminApprovalEmailOptions {
	to: string[];
	events: PendingApprovalDigestEvent[];
	pendingCount: number;
	reviewUrl: string;
	digestDate: string;
}

type SendAdminApprovalEmails = (
	options: AdminApprovalEmailOptions,
) => Promise<unknown>;

interface AdminApprovalDigestDependencies {
	getPendingEvents: () => Promise<PendingApprovalDigestData>;
	getRecipients: (now: Date) => Promise<string[]>;
	sendEmails: SendAdminApprovalEmails;
}

interface SendPendingEventApprovalDigestOptions {
	dependencies?: Partial<AdminApprovalDigestDependencies>;
	environment?: ApprovalDigestEnvironment;
	now?: Date;
}

export type PendingEventApprovalDigestResult =
	| { status: "no-pending"; pendingCount: 0 }
	| { status: "no-admins"; pendingCount: number }
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
	const rows = await db
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
		.limit(EVENT_PREVIEW_LIMIT);

	return {
		events: rows.map(({ id, title, createdAt, startsAt, timezone }) => ({
			id,
			title,
			createdAt,
			startsAt,
			timezone,
		})),
		pendingCount: rows[0]?.pendingCount ?? 0,
	};
}

/**
 * Match Better Auth's comma-separated role semantics. A permanent ban remains
 * active, while a temporary ban stops excluding the account at its expiry.
 */
export async function getAdminApprovalRecipients(
	now: Date = new Date(),
): Promise<string[]> {
	const hasAdminRole = sql<boolean>`exists (
		select 1
		from unnest(string_to_array(coalesce(${user.role}, ''), ',')) as role_entry(value)
		where role_entry.value ~ '^[[:space:]]*admin[[:space:]]*$'
	)`;
	const rows = await db
		.select({ email: user.email })
		.from(user)
		.where(
			and(
				eq(user.emailVerified, true),
				hasAdminRole,
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

export function getAdminApprovalReviewUrl(
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
	const getPendingEvents =
		dependencies?.getPendingEvents ?? getPendingApprovalDigestData;
	const pending = await getPendingEvents();

	if (pending.pendingCount === 0) {
		return { status: "no-pending", pendingCount: 0 };
	}

	const getRecipients =
		dependencies?.getRecipients ?? getAdminApprovalRecipients;
	const recipients = await getRecipients(now);

	if (recipients.length === 0) {
		return { status: "no-admins", pendingCount: pending.pendingCount };
	}

	const sendEmails = dependencies?.sendEmails ?? sendAdminApprovalEmails;

	await sendEmails({
		to: recipients,
		events: pending.events,
		pendingCount: pending.pendingCount,
		reviewUrl: getAdminApprovalReviewUrl(environment),
		digestDate: getPacificDigestDate(now),
	});

	return {
		status: "sent",
		pendingCount: pending.pendingCount,
		recipientCount: recipients.length,
	};
}
