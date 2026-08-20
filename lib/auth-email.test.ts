import { render } from "@react-email/render";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createPasswordResetEmail,
	createVerificationEmail,
	getAuthEmailConfig,
	sendVerificationEmail,
} from "@/lib/auth-email";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("getAuthEmailConfig", () => {
	it("normalizes a valid Resend configuration", () => {
		expect(
			getAuthEmailConfig({
				RESEND_API_KEY: " re_test_key ",
				RESEND_FROM_EMAIL: " SacTech <accounts@example.com> ",
			}),
		).toEqual({
			apiKey: "re_test_key",
			fromEmail: "SacTech <accounts@example.com>",
		});
	});

	it("reports every missing setting without exposing values", () => {
		expect(() => getAuthEmailConfig({})).toThrow(
			/RESEND_API_KEY must be set; RESEND_FROM_EMAIL must be set/,
		);
	});

	it("rejects malformed sender addresses and header injection", () => {
		for (const fromEmail of [
			"not-an-email",
			"SacTech <accounts@example.com>\r\nBcc: attacker@example.com",
		]) {
			expect(() =>
				getAuthEmailConfig({
					RESEND_API_KEY: "re_test_key",
					RESEND_FROM_EMAIL: fromEmail,
				}),
			).toThrow(/RESEND_FROM_EMAIL/);
		}
	});
});

describe("auth email templates", () => {
	it("renders verification content with React-escaped dynamic values", async () => {
		const email = createVerificationEmail({
			url: "https://example.com/verify?token=one&callback=/account",
			userName: "<Admin & Friends>",
		});
		const html = await render(email.react);

		expect(email.subject).toBe("Verify your SacTech email");
		expect(html).toContain("Hi &lt;Admin &amp; Friends&gt;,");
		expect(html).toContain(
			"https://example.com/verify?token=one&amp;callback=/account",
		);
		expect(html).not.toContain("Hi <Admin & Friends>,");
		expect(email.text).toContain(
			"https://example.com/verify?token=one&callback=/account",
		);
	});

	it("renders password reset content and rejects unsafe action URLs", async () => {
		const email = createPasswordResetEmail({
			url: "https://example.com/reset?token=secret",
		});
		const html = await render(email.react);

		expect(email.subject).toBe("Reset your SacTech password");
		expect(html).toContain("Reset password");
		expect(email.text).toContain("https://example.com/reset?token=secret");
		expect(() =>
			createPasswordResetEmail({ url: "javascript:alert(1)" }),
		).toThrow(/absolute HTTP\(S\) URL/);
	});

	it("passes React Email markup and a plain-text fallback to Resend", async () => {
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "SacTech <accounts@example.com>");
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ id: "email-id" }), {
				headers: { "content-type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await sendVerificationEmail({
			to: "member@example.com",
			url: "https://example.com/verify?token=secret",
			userName: "Member",
		});

		expect(fetchMock).toHaveBeenCalledOnce();
		const [, request] = fetchMock.mock.calls[0];
		const payload = JSON.parse(String(request?.body));

		expect(payload).toMatchObject({
			from: "SacTech <accounts@example.com>",
			subject: "Verify your SacTech email",
			text: expect.stringContaining("https://example.com/verify?token=secret"),
			to: "member@example.com",
		});
		expect(payload.html).toContain("Verify email");
		expect(payload).not.toHaveProperty("react");
	});

	it("propagates a Resend API failure to the Better Auth integration", async () => {
		vi.stubEnv("RESEND_API_KEY", "re_test_key");
		vi.stubEnv("RESEND_FROM_EMAIL", "SacTech <accounts@example.com>");
		vi.stubGlobal(
			"fetch",
			vi.fn<typeof fetch>().mockResolvedValue(
				new Response(
					JSON.stringify({
						message: "The sending domain is not verified.",
						name: "validation_error",
					}),
					{
						headers: { "content-type": "application/json" },
						status: 422,
					},
				),
			),
		);

		await expect(
			sendVerificationEmail({
				to: "member@example.com",
				url: "https://example.com/verify?token=secret",
			}),
		).rejects.toThrow("Resend failed to send auth email");
	});
});
