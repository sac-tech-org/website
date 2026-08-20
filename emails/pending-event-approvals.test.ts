import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import {
	MAX_PENDING_EVENTS_IN_EMAIL,
	PendingEventApprovalsEmail,
} from "@/emails/pending-event-approvals";
import { createPendingApprovalEmail } from "@/lib/admin-approval-email";

function getEvent(title: string, dayOffset = 0) {
	return {
		createdAt: new Date(Date.UTC(2026, 7, 19 + dayOffset, 18)),
		startsAt: new Date(Date.UTC(2026, 8, 1 + dayOffset, 1)),
		title,
		timezone: "America/Los_Angeles",
	};
}

describe("pending event approval email", () => {
	it("renders escaped event titles, a bounded list, and the review link", async () => {
		const events = Array.from(
			{ length: MAX_PENDING_EVENTS_IN_EMAIL + 2 },
			(_, index) =>
				getEvent(
					index === 0 ? "<Script & Community>" : `Pending event ${index + 1}`,
					index,
				),
		);
		const reviewUrl =
			"https://example.com/admin/events?status=pending&from=email";
		const html = await render(
			PendingEventApprovalsEmail({
				events,
				pendingCount: events.length,
				reviewUrl,
			}),
		);

		expect(html).toContain("&lt;Script &amp; Community&gt;");
		expect(html).not.toContain("<Script & Community>");
		expect(html).toContain("Pending event 10");
		expect(html).not.toContain("Pending event 11");
		expect(html).toContain("Submitted Aug 19, 2026");
		expect(html).toContain("Starts Aug 31, 2026");
		expect(html).toMatch(/…and\s*(?:<!-- -->)?2(?:<!-- -->)?\s*more/);
		expect(html).toContain(
			"https://example.com/admin/events?status=pending&amp;from=email",
		);
		expect(html).toContain("Review pending events");
		expect(html).toContain("Hi reviewer,");
		expect(html).toContain("account can review events");
	});

	it("pluralizes the subject and supplies an explicit plain-text fallback", () => {
		const singular = createPendingApprovalEmail({
			events: [getEvent("One meetup")],
			pendingCount: 1,
			reviewUrl: "https://example.com/admin/events",
		});
		const plural = createPendingApprovalEmail({
			events: [getEvent("First meetup"), getEvent("Second meetup", 1)],
			pendingCount: 2,
			reviewUrl: "https://example.com/admin/events",
		});

		expect(singular.subject).toBe("1 SacTech event needs approval");
		expect(singular.text).toContain("There is 1 event waiting for approval.");
		expect(singular.text).toContain("Hi reviewer,");
		expect(singular.text).toContain("account can review events.");
		expect(plural.subject).toBe("2 SacTech events need approval");
		expect(plural.text).toContain("- First meetup\n  Submitted Aug 19, 2026");
		expect(plural.text).toContain("- Second meetup\n  Submitted Aug 20, 2026");
		expect(plural.text).toContain("https://example.com/admin/events");
	});

	it("rejects unsafe review URLs and impossible pending counts", () => {
		expect(() =>
			createPendingApprovalEmail({
				events: [],
				pendingCount: 1,
				reviewUrl: "javascript:alert(1)",
			}),
		).toThrow(/absolute HTTP\(S\) URL/);

		expect(() =>
			createPendingApprovalEmail({
				events: [],
				pendingCount: 0,
				reviewUrl: "https://example.com/admin/events",
			}),
		).toThrow(/positive integer/);
	});
});
