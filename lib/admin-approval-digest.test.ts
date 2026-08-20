import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

vi.mock("@/lib/admin-approval-email", () => ({
	sendApprovalReminderEmails: vi.fn(),
}));

import {
	getApprovalReviewUrl,
	getPacificDigestDate,
	sendPendingEventApprovalDigest,
	type PendingApprovalDigestData,
} from "@/lib/admin-approval-digest";

const NOW = new Date("2026-08-20T15:00:00.000Z");
const pending: PendingApprovalDigestData = {
	events: [
		{
			id: "10000000-0000-4000-8000-000000000001",
			title: "Sacramento TypeScript Meetup",
			createdAt: new Date("2026-08-19T18:00:00.000Z"),
			startsAt: new Date("2026-09-01T01:00:00.000Z"),
			timezone: "America/Los_Angeles",
		},
	],
	pendingCount: 3,
};

describe("approval reminder digest helpers", () => {
	it("builds the review link from the configured site origin", () => {
		expect(
			getApprovalReviewUrl({
				URL: " https://events.sactech.test/a/path?ignored=yes#ignored ",
			}),
		).toBe("https://events.sactech.test/admin/events");
	});

	it.each([
		undefined,
		"",
		"/relative",
		"ftp://events.sactech.test",
		"https://admin:secret@events.sactech.test",
		"https://events.sactech.test\n.example.test",
	])("rejects an unsafe or missing site URL: %s", (value) => {
		expect(() => getApprovalReviewUrl({ URL: value })).toThrow(
			"URL must be set to the site's absolute HTTP(S) URL",
		);
	});

	it("uses the Pacific calendar date on both sides of midnight", () => {
		expect(getPacificDigestDate(new Date("2026-08-20T06:59:59.000Z"))).toBe(
			"2026-08-19",
		);
		expect(getPacificDigestDate(new Date("2026-08-20T07:00:00.000Z"))).toBe(
			"2026-08-20",
		);
		expect(getPacificDigestDate(new Date("2026-01-15T07:30:00.000Z"))).toBe(
			"2026-01-14",
		);
	});
});

describe("sendPendingEventApprovalDigest", () => {
	it("stops before querying reviewers when no events need approval", async () => {
		const getRecipients = vi.fn();
		const sendEmails = vi.fn();

		await expect(
			sendPendingEventApprovalDigest({
				dependencies: {
					getPendingEvents: vi.fn().mockResolvedValue({
						events: [],
						pendingCount: 0,
					}),
					getRecipients,
					sendEmails,
				},
			}),
		).resolves.toEqual({ status: "no-pending", pendingCount: 0 });
		expect(getRecipients).not.toHaveBeenCalled();
		expect(sendEmails).not.toHaveBeenCalled();
	});

	it("does not require email or URL configuration when there are no reviewers", async () => {
		const getRecipients = vi.fn().mockResolvedValue([]);
		const sendEmails = vi.fn();

		await expect(
			sendPendingEventApprovalDigest({
				now: NOW,
				environment: {},
				dependencies: {
					getPendingEvents: vi.fn().mockResolvedValue(pending),
					getRecipients,
					sendEmails,
				},
			}),
		).resolves.toEqual({ status: "no-reviewers", pendingCount: 3 });
		expect(getRecipients).toHaveBeenCalledExactlyOnceWith(NOW);
		expect(sendEmails).not.toHaveBeenCalled();
	});

	it("sends the bounded event preview with counts, review URL, and Pacific date", async () => {
		const sendEmails = vi.fn().mockResolvedValue(undefined);

		await expect(
			sendPendingEventApprovalDigest({
				now: NOW,
				environment: { URL: "https://events.sactech.test/deploy-path" },
				dependencies: {
					getPendingEvents: vi.fn().mockResolvedValue(pending),
					getRecipients: vi
						.fn()
						.mockResolvedValue(["admin-a@example.com", "admin-b@example.com"]),
					sendEmails,
				},
			}),
		).resolves.toEqual({
			status: "sent",
			pendingCount: 3,
			recipientCount: 2,
		});
		expect(sendEmails).toHaveBeenCalledExactlyOnceWith({
			to: ["admin-a@example.com", "admin-b@example.com"],
			events: pending.events,
			pendingCount: 3,
			reviewUrl: "https://events.sactech.test/admin/events",
			digestDate: "2026-08-20",
		});
	});

	it("does not hide delivery failures", async () => {
		const deliveryError = new Error("Resend batch failed");

		await expect(
			sendPendingEventApprovalDigest({
				now: NOW,
				environment: { URL: "https://events.sactech.test" },
				dependencies: {
					getPendingEvents: vi.fn().mockResolvedValue(pending),
					getRecipients: vi.fn().mockResolvedValue(["admin@example.com"]),
					sendEmails: vi.fn().mockRejectedValue(deliveryError),
				},
			}),
		).rejects.toBe(deliveryError);
	});
});
