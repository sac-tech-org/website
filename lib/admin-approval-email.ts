import type { ReactElement } from "react";
import { Resend, type CreateBatchOptions } from "resend";
import {
	getListedPendingApprovalEvents,
	getPendingApprovalEventDetails,
	getPendingApprovalSubject,
	PendingEventApprovalsEmail,
	type PendingApprovalEmailEvent,
} from "@/emails/pending-event-approvals";
import { getAuthEmailConfig } from "@/lib/auth-email";

const RESEND_BATCH_SIZE = 100;
const DIGEST_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface PendingApprovalEmailProps {
	events: readonly PendingApprovalEmailEvent[];
	pendingCount: number;
	reviewUrl: string;
}

interface PendingApprovalEmailContent {
	react: ReactElement;
	subject: string;
	text: string;
}

export interface SendApprovalReminderEmailsOptions extends PendingApprovalEmailProps {
	digestDate: string;
	to: readonly string[];
}

export interface SendApprovalReminderEmailsResult {
	batchCount: number;
	recipientCount: number;
}

function getReviewUrl(value: string) {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		throw new Error("Admin review URL must be an absolute HTTP(S) URL");
	}

	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username ||
		url.password
	) {
		throw new Error("Admin review URL must be an absolute HTTP(S) URL");
	}

	return url.href;
}

function getPendingCount(value: number) {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new Error("Pending approval count must be a positive integer");
	}

	return value;
}

function getDigestDate(value: string) {
	if (!DIGEST_DATE_PATTERN.test(value)) {
		throw new Error("Digest date must use the YYYY-MM-DD format");
	}

	return value;
}

function getRecipients(values: readonly string[]) {
	const recipients: string[] = [];
	const seenRecipients = new Set<string>();

	// Preserve the query's deterministic order so retries keep the same recipients
	// in each idempotent batch, while still protecting against duplicate rows.
	for (const value of values) {
		const recipient = value.trim();
		const normalizedRecipient = recipient.toLowerCase();

		if (
			!recipient ||
			recipient.includes("\r") ||
			recipient.includes("\n") ||
			seenRecipients.has(normalizedRecipient)
		) {
			continue;
		}

		seenRecipients.add(normalizedRecipient);
		recipients.push(recipient);
	}

	return recipients;
}

function chunk<T>(values: readonly T[], size: number) {
	const chunks: T[][] = [];

	for (let index = 0; index < values.length; index += size) {
		chunks.push(values.slice(index, index + size));
	}

	return chunks;
}

export function createPendingApprovalEmail({
	events,
	pendingCount,
	reviewUrl,
}: PendingApprovalEmailProps): PendingApprovalEmailContent {
	const safePendingCount = getPendingCount(pendingCount);
	const safeReviewUrl = getReviewUrl(reviewUrl);
	const listedEvents = getListedPendingApprovalEvents(events);
	const unlistedCount = Math.max(0, safePendingCount - listedEvents.length);
	const subject = getPendingApprovalSubject(safePendingCount);
	const eventLines = listedEvents.flatMap((event) => [
		`- ${event.title}`,
		`  ${getPendingApprovalEventDetails(event)}`,
	]);

	return {
		react: PendingEventApprovalsEmail({
			events: listedEvents,
			pendingCount: safePendingCount,
			reviewUrl: safeReviewUrl,
		}),
		subject,
		text: [
			"Hi reviewer,",
			"",
			safePendingCount === 1
				? "There is 1 event waiting for approval."
				: `There are ${safePendingCount} events waiting for approval.`,
			...(eventLines.length > 0 ? ["", ...eventLines] : []),
			...(unlistedCount > 0 ? [`...and ${unlistedCount} more`] : []),
			"",
			"Review pending events:",
			safeReviewUrl,
			"",
			"You are receiving this reminder because your SacTech account can review events.",
		].join("\n"),
	};
}

export async function sendApprovalReminderEmails({
	digestDate,
	events,
	pendingCount,
	reviewUrl,
	to,
}: SendApprovalReminderEmailsOptions): Promise<SendApprovalReminderEmailsResult> {
	const recipients = getRecipients(to);

	if (recipients.length === 0) {
		return { batchCount: 0, recipientCount: 0 };
	}

	const safeDigestDate = getDigestDate(digestDate);
	const email = createPendingApprovalEmail({
		events,
		pendingCount,
		reviewUrl,
	});
	const { apiKey, fromEmail } = getAuthEmailConfig();
	const resend = new Resend(apiKey);
	const recipientChunks = chunk(recipients, RESEND_BATCH_SIZE);

	for (const [chunkIndex, recipientChunk] of recipientChunks.entries()) {
		const payload: CreateBatchOptions = recipientChunk.map((recipient) => ({
			from: fromEmail,
			react: email.react,
			subject: email.subject,
			text: email.text,
			to: recipient,
		}));
		const { error } = await resend.batch.send(payload, {
			batchValidation: "strict",
			idempotencyKey: `sactech-reviewer-reminder-${safeDigestDate}-${chunkIndex}`,
		});

		if (error) {
			throw new Error("Resend failed to send approval reminders", {
				cause: error,
			});
		}
	}

	return {
		batchCount: recipientChunks.length,
		recipientCount: recipients.length,
	};
}
