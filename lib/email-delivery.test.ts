import { describe, expect, it } from "vitest";
import {
	isEmailDeliveryEnabled,
	isLocalDevelopmentEnvironment,
} from "@/lib/email-delivery";

describe("local email delivery", () => {
	it("recognizes Netlify Dev and plain Next development", () => {
		expect(isLocalDevelopmentEnvironment({ CONTEXT: "dev" })).toBe(true);
		expect(isLocalDevelopmentEnvironment({ NODE_ENV: "development" })).toBe(
			true,
		);
	});

	it("does not weaken deployed contexts even if NODE_ENV is overridden", () => {
		for (const context of [
			"production",
			"deploy-preview",
			"branch-deploy",
			"preview-server",
		]) {
			expect(
				isLocalDevelopmentEnvironment({
					CONTEXT: context,
					NODE_ENV: "development",
				}),
			).toBe(false);
			expect(
				isEmailDeliveryEnabled({
					CONTEXT: context,
					NODE_ENV: "development",
				}),
			).toBe(true);
		}
	});

	it("never treats a remote Netlify Preview Server as local", () => {
		expect(
			isLocalDevelopmentEnvironment({
				CONTEXT: "dev",
				NETLIFY_PREVIEW_SERVER: "true",
				NODE_ENV: "development",
			}),
		).toBe(false);
		expect(
			isEmailDeliveryEnabled({
				CONTEXT: "dev",
				NETLIFY_PREVIEW_SERVER: "true",
				NODE_ENV: "development",
			}),
		).toBe(true);
	});

	it("disables local email unless live delivery is explicitly requested", () => {
		expect(
			isEmailDeliveryEnabled({
				CONTEXT: "dev",
				RESEND_API_KEY: "re_inherited_key",
				RESEND_FROM_EMAIL: "SacTech <accounts@example.com>",
			}),
		).toBe(false);
	});

	it("enables the complete local email flow when both settings exist", () => {
		expect(
			isEmailDeliveryEnabled({
				EMAIL_DELIVERY_MODE: "live",
				NODE_ENV: "development",
				RESEND_API_KEY: " re_local_key ",
				RESEND_FROM_EMAIL: " SacTech <accounts@example.com> ",
			}),
		).toBe(true);
	});

	it("rejects partial local configuration without exposing its value", () => {
		const secret = "re_do_not_log_this_value";
		let error: unknown;

		try {
			isEmailDeliveryEnabled({
				CONTEXT: "dev",
				EMAIL_DELIVERY_MODE: "live",
				RESEND_API_KEY: secret,
			});
		} catch (caughtError) {
			error = caughtError;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain(
			"requires both RESEND_API_KEY and RESEND_FROM_EMAIL",
		);
		expect((error as Error).message).not.toContain(secret);
	});

	it("rejects an unsupported mode without exposing its value", () => {
		const invalidMode = "send-production-mail";
		expect(() =>
			isEmailDeliveryEnabled({
				CONTEXT: "dev",
				EMAIL_DELIVERY_MODE: invalidMode,
			}),
		).toThrow("EMAIL_DELIVERY_MODE must be set to live or left unset");

		try {
			isEmailDeliveryEnabled({
				CONTEXT: "dev",
				EMAIL_DELIVERY_MODE: invalidMode,
			});
		} catch (error) {
			expect(String(error)).not.toContain(invalidMode);
		}
	});
});
