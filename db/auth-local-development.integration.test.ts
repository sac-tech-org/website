import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authEmailMocks = vi.hoisted(() => ({
	after: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
	sendVerificationEmail: vi.fn(),
}));

vi.mock("next/server", () => ({ after: authEmailMocks.after }));
vi.mock("@/lib/auth-email", () => ({
	sendPasswordResetEmail: authEmailMocks.sendPasswordResetEmail,
	sendVerificationEmail: authEmailMocks.sendVerificationEmail,
}));

const migrationsDirectory = fileURLToPath(
	new URL("../netlify/database/migrations", import.meta.url),
);
const environmentKeys = [
	"BETTER_AUTH_ALLOWED_HOSTS",
	"BETTER_AUTH_SCHEMA_GENERATION",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"CONTEXT",
	"EMAIL_DELIVERY_MODE",
	"NETLIFY_DB_DRIVER",
	"NETLIFY_DB_URL",
	"NETLIFY_PREVIEW_SERVER",
	"RESEND_API_KEY",
	"RESEND_FROM_EMAIL",
	"URL",
] as const;
const originalEnvironment = Object.fromEntries(
	environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

describe("Better Auth without local email delivery", () => {
	const database = new NetlifyDB({ logger: () => undefined });
	let auth: (typeof import("@/lib/auth-config"))["auth"];
	let closeDrizzleClient: (() => Promise<void>) | undefined;
	let databaseStarted = false;

	beforeAll(async () => {
		const databaseUrl = new URL(await database.start());
		databaseStarted = true;

		if (!databaseUrl.username) {
			databaseUrl.username = "postgres";
		}

		process.env.NETLIFY_DB_URL = databaseUrl.href;
		process.env.NETLIFY_DB_DRIVER = "server";
		process.env.BETTER_AUTH_SECRET =
			"sactech-local-auth-integration-test-secret";
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.BETTER_AUTH_ALLOWED_HOSTS = "localhost:3000";
		process.env.CONTEXT = "dev";
		delete process.env.BETTER_AUTH_SCHEMA_GENERATION;
		delete process.env.EMAIL_DELIVERY_MODE;
		delete process.env.NETLIFY_PREVIEW_SERVER;
		delete process.env.RESEND_API_KEY;
		delete process.env.RESEND_FROM_EMAIL;
		delete process.env.URL;

		await database.applyMigrations(migrationsDirectory);
		vi.resetModules();

		const { db } = await import("@/db");
		const databaseClient: unknown = db.$client;

		if (
			typeof databaseClient === "object" &&
			databaseClient !== null &&
			"end" in databaseClient &&
			typeof databaseClient.end === "function"
		) {
			closeDrizzleClient = databaseClient.end.bind(databaseClient);
		}

		({ auth } = await import("@/lib/auth-config"));
	});

	afterAll(async () => {
		try {
			await closeDrizzleClient?.();
		} finally {
			try {
				if (databaseStarted) {
					await database.stop();
				}
			} finally {
				for (const key of environmentKeys) {
					const originalValue = originalEnvironment[key];

					if (originalValue === undefined) {
						delete process.env[key];
					} else {
						process.env[key] = originalValue;
					}
				}

				vi.resetModules();
			}
		}
	});

	it("creates an immediate session and leaves email endpoints disabled", async () => {
		const email = "local-no-email@sactech.test";
		const password = "local-development-password";
		const authOrigin = "http://localhost:3000";
		const signUpResponse = await auth.handler(
			new Request(`${authOrigin}/api/auth/sign-up/email`, {
				body: JSON.stringify({
					callbackURL: "/auth/verify-email",
					email,
					name: "Local Developer",
					password,
				}),
				headers: {
					"content-type": "application/json",
					origin: authOrigin,
				},
				method: "POST",
			}),
		);
		expect(signUpResponse.status).toBe(200);
		const signUpResult = await signUpResponse.json();

		expect(signUpResult).toMatchObject({
			token: expect.any(String),
			user: { email, emailVerified: false },
		});
		const signUpSetCookie = signUpResponse.headers.get("set-cookie");
		expect(signUpSetCookie).toMatch(
			/(?:__Secure-)?better-auth\.session_token=/,
		);
		const signUpSessionCookie = signUpSetCookie?.split(";", 1)[0];
		expect(signUpSessionCookie).toBeDefined();

		const sessionResponse = await auth.handler(
			new Request(`${authOrigin}/api/auth/get-session`, {
				headers: { cookie: signUpSessionCookie ?? "" },
			}),
		);
		expect(sessionResponse.status).toBe(200);
		expect(await sessionResponse.json()).toMatchObject({
			user: { email, emailVerified: false },
		});
		expect(authEmailMocks.after).not.toHaveBeenCalled();
		expect(authEmailMocks.sendVerificationEmail).not.toHaveBeenCalled();

		const signInResponse = await auth.handler(
			new Request(`${authOrigin}/api/auth/sign-in/email`, {
				body: JSON.stringify({ email, password }),
				headers: {
					"content-type": "application/json",
					origin: authOrigin,
				},
				method: "POST",
			}),
		);
		expect(signInResponse.status).toBe(200);
		expect(await signInResponse.json()).toMatchObject({
			token: expect.any(String),
			user: { email, emailVerified: false },
		});

		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			const resetResponse = await auth.handler(
				new Request(`${authOrigin}/api/auth/request-password-reset`, {
					body: JSON.stringify({
						email,
						redirectTo: "/auth/reset-password",
					}),
					headers: {
						"content-type": "application/json",
						origin: authOrigin,
					},
					method: "POST",
				}),
			);

			expect(resetResponse.status).toBe(400);
			expect(await resetResponse.json()).toMatchObject({
				code: "RESET_PASSWORD_DISABLED",
			});
		} finally {
			consoleError.mockRestore();
		}

		expect(authEmailMocks.sendPasswordResetEmail).not.toHaveBeenCalled();
	});
});
