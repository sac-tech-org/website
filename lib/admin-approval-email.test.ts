import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAdminApprovalEmails } from "@/lib/admin-approval-email";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

function getJsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
		status,
	});
}

const pendingEvent = {
	createdAt: new Date("2026-08-19T18:00:00.000Z"),
	startsAt: new Date("2026-09-01T01:00:00.000Z"),
	title: "Community night",
	timezone: "America/Los_Angeles",
};

describe("sendAdminApprovalEmails", () => {
	it("sends private per-admin batch entries in chunks of at most 100", async () => {
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "SacTech <accounts@example.com>");
		const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
			getJsonResponse({
				data: [{ id: "email-id" }],
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const recipients = Array.from(
			{ length: 101 },
			(_, index) => `admin-${index}@example.com`,
		);

		const result = await sendAdminApprovalEmails({
			digestDate: "2026-08-20",
			events: [pendingEvent],
			pendingCount: 1,
			reviewUrl: "https://example.com/admin/events",
			to: recipients,
		});

		expect(result).toEqual({ batchCount: 2, recipientCount: 101 });
		expect(fetchMock).toHaveBeenCalledTimes(2);

		const requests = fetchMock.mock.calls.map(([, request]) => request);
		const payloads = requests.map((request) =>
			JSON.parse(String(request?.body)),
		) as Array<Array<Record<string, unknown>>>;

		expect(payloads.map((payload) => payload.length)).toEqual([100, 1]);
		// The data query sorts admins before calling this helper. The sender keeps
		// that exact order so the same date/chunk key always represents the same set.
		expect(payloads.flat().map((email) => email.to)).toEqual(recipients);
		expect(payloads.flat().every((email) => typeof email.to === "string")).toBe(
			true,
		);
		expect(payloads[0][0]).toMatchObject({
			from: "SacTech <accounts@example.com>",
			subject: "1 SacTech event needs approval",
			text: expect.stringContaining("https://example.com/admin/events"),
			to: "admin-0@example.com",
		});
		expect(payloads[0][0].text).toContain("Submitted Aug 19, 2026");
		expect(payloads[0][0].html).toContain("Review pending events");
		expect(JSON.stringify(payloads[0][0])).not.toContain("admin-1@example.com");
		expect(payloads.flat().every((email) => !("cc" in email))).toBe(true);
		expect(payloads.flat().every((email) => !("bcc" in email))).toBe(true);

		expect(new Headers(requests[0]?.headers).get("idempotency-key")).toBe(
			"sactech-admin-approval-digest-2026-08-20-0",
		);
		expect(new Headers(requests[0]?.headers).get("x-batch-validation")).toBe(
			"strict",
		);
		expect(new Headers(requests[1]?.headers).get("idempotency-key")).toBe(
			"sactech-admin-approval-digest-2026-08-20-1",
		);
	});

	it("deduplicates recipients without making their addresses public", async () => {
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "SacTech <accounts@example.com>");
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(getJsonResponse({ data: [{ id: "email-id" }] }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await sendAdminApprovalEmails({
			digestDate: "2026-08-20",
			events: [pendingEvent],
			pendingCount: 1,
			reviewUrl: "https://example.com/admin/events",
			to: [" Admin@example.com ", "admin@example.com", "second@example.com"],
		});

		expect(result.recipientCount).toBe(2);
		const [, request] = fetchMock.mock.calls[0];
		const payload = JSON.parse(String(request?.body)) as Array<{
			to: string;
		}>;
		expect(payload.map((email) => email.to)).toEqual([
			"Admin@example.com",
			"second@example.com",
		]);
	});

	it("does not initialize Resend when there are no recipients", async () => {
		const fetchMock = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			sendAdminApprovalEmails({
				digestDate: "2026-08-20",
				events: [pendingEvent],
				pendingCount: 1,
				reviewUrl: "https://example.com/admin/events",
				to: [],
			}),
		).resolves.toEqual({ batchCount: 0, recipientCount: 0 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("throws on a Resend batch failure so the scheduled run fails", async () => {
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "SacTech <accounts@example.com>");
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				getJsonResponse(
					{
						message: "The sending domain is not verified.",
						name: "validation_error",
					},
					422,
				),
			),
		);

		await expect(
			sendAdminApprovalEmails({
				digestDate: "2026-08-20",
				events: [pendingEvent],
				pendingCount: 1,
				reviewUrl: "https://example.com/admin/events",
				to: ["admin@example.com"],
			}),
		).rejects.toThrow("Resend failed to send admin approval digest");
	});
});
