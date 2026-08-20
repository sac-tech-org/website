import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

interface AuthEmailOptions {
	to: string;
	url: string;
	userName?: string;
}

const authMocks = vi.hoisted(() => {
	const backgroundTasks: Promise<unknown>[] = [];

	return {
		after: vi.fn((callback: () => unknown) => {
			backgroundTasks.push(Promise.resolve().then(callback));
		}),
		backgroundTasks,
		sendPasswordResetEmail: vi
			.fn<(options: AuthEmailOptions) => Promise<void>>()
			.mockResolvedValue(undefined),
		sendVerificationEmail: vi
			.fn<(options: AuthEmailOptions) => Promise<void>>()
			.mockResolvedValue(undefined),
	};
});

vi.mock("next/server", () => ({ after: authMocks.after }));

vi.mock("@/lib/auth-email", () => ({
	sendPasswordResetEmail: authMocks.sendPasswordResetEmail,
	sendVerificationEmail: authMocks.sendVerificationEmail,
}));

const migrationsDirectory = fileURLToPath(
	new URL("../netlify/database/migrations", import.meta.url),
);

const environmentKeys = [
	"BETTER_AUTH_ALLOWED_HOSTS",
	"BETTER_AUTH_SCHEMA_GENERATION",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"DEPLOY_PRIME_URL",
	"DEPLOY_URL",
	"EMAIL_DELIVERY_MODE",
	"NETLIFY",
	"NETLIFY_DB_DRIVER",
	"NETLIFY_DB_URL",
	"RESEND_API_KEY",
	"RESEND_FROM_EMAIL",
	"SITE_ID",
	"SITE_NAME",
	"URL",
] as const;

const originalEnvironment = Object.fromEntries(
	environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

async function flushBackgroundTasks() {
	while (authMocks.backgroundTasks.length > 0) {
		const tasks = authMocks.backgroundTasks.splice(0);
		await Promise.all(tasks);
	}
}

describe("Better Auth with the Netlify Drizzle adapter", () => {
	const database = new NetlifyDB({ logger: () => undefined });
	let auth: (typeof import("@/lib/auth-config"))["auth"];
	let closeDrizzleClient: (() => Promise<void>) | undefined;
	let databaseStarted = false;

	beforeAll(async () => {
		const databaseUrl = new URL(await database.start());
		databaseStarted = true;

		// Netlify's build image does not set USER, so do not make pg infer it.
		if (!databaseUrl.username) {
			databaseUrl.username = "postgres";
		}

		process.env.NETLIFY_DB_URL = databaseUrl.href;
		process.env.NETLIFY_DB_DRIVER = "server";
		process.env.BETTER_AUTH_SECRET =
			"sactech-better-auth-integration-test-secret";
		process.env.SITE_ID = "sactech-auth-integration-site-id";
		process.env.SITE_NAME = "sactech-auth-integration";
		process.env.URL = "https://auth-integration.sactech.test";
		delete process.env.BETTER_AUTH_URL;
		delete process.env.BETTER_AUTH_ALLOWED_HOSTS;
		delete process.env.BETTER_AUTH_SCHEMA_GENERATION;
		delete process.env.DEPLOY_PRIME_URL;
		delete process.env.DEPLOY_URL;
		delete process.env.NETLIFY;
		process.env.EMAIL_DELIVERY_MODE = "live";
		process.env.RESEND_API_KEY = "re_auth_integration_test";
		process.env.RESEND_FROM_EMAIL = "SacTech <accounts@sactech.test>";

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

	beforeEach(() => {
		authMocks.after.mockClear();
		authMocks.sendPasswordResetEmail.mockClear();
		authMocks.sendVerificationEmail.mockClear();
	});

	afterEach(async () => {
		await flushBackgroundTasks();
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

	it("accepts auth requests from this site's Netlify preview hosts", async () => {
		const previewOrigin =
			"https://deploy-preview-42--sactech-auth-integration.netlify.app";
		const response = await auth.handler(
			new Request(`${previewOrigin}/api/auth/get-session`, {
				headers: { origin: previewOrigin },
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toBeNull();
	});

	it("accepts the local Netlify Dev origin outside production", async () => {
		const localOrigin = "http://localhost:8888";
		const response = await auth.handler(
			new Request(`${localOrigin}/api/auth/get-session`, {
				headers: { origin: localOrigin },
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toBeNull();
	});

	it("exposes the configured role permissions through Better Auth", async () => {
		await expect(
			auth.api.userHasPermission({
				body: {
					role: "admin",
					permissions: {
						event: ["approve", "reject", "receive-approval-reminders"],
						user: ["set-role", "ban"],
					},
				},
			}),
		).resolves.toEqual({ error: null, success: true });
		await expect(
			auth.api.userHasPermission({
				body: {
					role: "approver",
					permissions: { event: ["approve", "reject"] },
				},
			}),
		).resolves.toEqual({ error: null, success: true });
		await expect(
			auth.api.userHasPermission({
				body: {
					role: "approver",
					permissions: { user: ["set-role"] },
				},
			}),
		).resolves.toEqual({ error: null, success: false });
		await expect(
			auth.api.userHasPermission({
				body: {
					role: "submitter",
					permissions: { event: ["approve"] },
				},
			}),
		).resolves.toEqual({ error: null, success: false });
	});

	it("persists an email and password account in the migrated schema", async () => {
		const email = "account-integration@sactech.test";
		const name = "SacTech Test Member";
		const password = "deterministic-password";
		const result = await auth.api.signUpEmail({
			body: { email, name, password },
		});

		expect(result.user).toMatchObject({ email, name });

		const users = await database.query<{
			email: string;
			email_verified: boolean;
			id: string;
			name: string;
			role: string;
		}>(
			`SELECT id, name, email, email_verified, role
			 FROM "user"
			 WHERE email = $1`,
			[email],
		);

		expect(users.rows).toEqual([
			{
				email,
				email_verified: false,
				id: result.user.id,
				name,
				role: "submitter",
			},
		]);

		const accounts = await database.query<{
			account_id: string;
			password: string | null;
			provider_id: string;
			user_id: string;
		}>(
			`SELECT account_id, provider_id, user_id, password
			 FROM "account"
			 WHERE user_id = $1`,
			[result.user.id],
		);

		expect(accounts.rows).toHaveLength(1);
		expect(accounts.rows[0]).toMatchObject({
			account_id: result.user.id,
			provider_id: "credential",
			user_id: result.user.id,
		});
		expect(accounts.rows[0].password).toEqual(expect.any(String));
		expect(accounts.rows[0].password).not.toBe(password);
	});

	it("keeps public verification resend responses generic during delivery failures", async () => {
		const email = "verification-outage@sactech.test";
		const callbackURL = "/auth/verify-email";
		await auth.api.signUpEmail({
			body: {
				callbackURL,
				email,
				name: "Verification Outage Test Member",
				password: "deterministic-password",
			},
		});
		await flushBackgroundTasks();

		authMocks.sendVerificationEmail.mockRejectedValueOnce(
			new Error(`provider failure for ${email}; token=do-not-log`),
		);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		try {
			const existingAccountResult = await auth.api.sendVerificationEmail({
				body: { callbackURL, email },
			});
			const unknownAccountResult = await auth.api.sendVerificationEmail({
				body: {
					callbackURL,
					email: "missing-verification-outage@sactech.test",
				},
			});

			expect(existingAccountResult).toEqual({ status: true });
			expect(unknownAccountResult).toEqual(existingAccountResult);
			expect(consoleError).toHaveBeenCalledWith(
				"Failed to deliver verification email. Check the server email configuration and Resend logs.",
				{ errorType: "Error" },
			);
			const loggedValues = JSON.stringify(consoleError.mock.calls);
			expect(loggedValues).not.toContain(email);
			expect(loggedValues).not.toContain("do-not-log");
		} finally {
			consoleError.mockRestore();
		}
	});

	it("verifies an email and resets its password through generated auth links", async () => {
		const authOrigin = "https://auth-integration.sactech.test";
		const email = "email-flow-integration@sactech.test";
		const name = "Email Flow Test Member";
		const originalPassword = "original-deterministic-password";
		const newPassword = "replacement-deterministic-password";
		const verificationCallback = "/auth/verify-email";
		const resetCallback = "/auth/reset-password";

		const signUpResult = await auth.api.signUpEmail({
			body: {
				callbackURL: verificationCallback,
				email,
				name,
				password: originalPassword,
			},
		});
		await flushBackgroundTasks();

		expect(signUpResult).toMatchObject({
			token: null,
			user: { email, emailVerified: false, name },
		});
		expect(authMocks.after).toHaveBeenCalledOnce();
		expect(authMocks.sendVerificationEmail).toHaveBeenCalledWith({
			to: email,
			url: expect.any(String),
			userName: name,
		});

		const verificationEmail =
			authMocks.sendVerificationEmail.mock.calls[0]?.[0];
		expect(verificationEmail).toBeDefined();
		const verificationUrl = new URL(verificationEmail?.url ?? "");
		expect(verificationUrl.origin).toBe(authOrigin);
		expect(verificationUrl.pathname).toBe("/api/auth/verify-email");
		expect(verificationUrl.searchParams.get("token")).toEqual(
			expect.any(String),
		);
		expect(verificationUrl.searchParams.get("callbackURL")).toBe(
			verificationCallback,
		);

		const invalidVerificationUrl = new URL(
			"/api/auth/verify-email",
			authOrigin,
		);
		invalidVerificationUrl.searchParams.set("token", "invalid-token");
		invalidVerificationUrl.searchParams.set(
			"callbackURL",
			verificationCallback,
		);
		const invalidVerificationResponse = await auth.handler(
			new Request(invalidVerificationUrl, { redirect: "manual" }),
		);
		expect(invalidVerificationResponse.status).toBe(302);
		const invalidVerificationLocation = new URL(
			invalidVerificationResponse.headers.get("location") ?? "",
			invalidVerificationUrl,
		);
		expect(invalidVerificationLocation.pathname).toBe(verificationCallback);
		expect(invalidVerificationLocation.searchParams.get("error")).toBe(
			"INVALID_TOKEN",
		);

		const verificationResponse = await auth.handler(
			new Request(verificationUrl.href, { redirect: "manual" }),
		);
		expect(verificationResponse.status).toBe(302);
		const verificationLocation = verificationResponse.headers.get("location");
		expect(verificationLocation).not.toBeNull();
		expect(new URL(verificationLocation ?? "", verificationUrl).pathname).toBe(
			verificationCallback,
		);

		const verificationSetCookie =
			verificationResponse.headers.get("set-cookie");
		expect(verificationSetCookie).toMatch(
			/(?:__Secure-)?better-auth\.session_token=/,
		);
		const verificationSessionCookie = verificationSetCookie?.split(";", 1)[0];
		expect(verificationSessionCookie).toBeDefined();

		const verifiedUsers = await database.query<{
			email_verified: boolean;
		}>(
			`SELECT email_verified
			 FROM "user"
			 WHERE email = $1`,
			[email],
		);
		expect(verifiedUsers.rows).toEqual([{ email_verified: true }]);

		const verifiedSessionResponse = await auth.handler(
			new Request(`${authOrigin}/api/auth/get-session`, {
				headers: { cookie: verificationSessionCookie ?? "" },
			}),
		);
		expect(await verifiedSessionResponse.json()).toMatchObject({
			user: { email, emailVerified: true },
		});

		const resetRequestResult = await auth.api.requestPasswordReset({
			body: { email, redirectTo: resetCallback },
		});
		await flushBackgroundTasks();
		const unknownAccountResult = await auth.api.requestPasswordReset({
			body: {
				email: "missing-email-flow@sactech.test",
				redirectTo: resetCallback,
			},
		});

		expect(resetRequestResult).toEqual({
			message:
				"If this email exists in our system, check your email for the reset link",
			status: true,
		});
		expect(unknownAccountResult).toEqual(resetRequestResult);
		expect(authMocks.sendPasswordResetEmail).toHaveBeenCalledOnce();
		expect(authMocks.sendPasswordResetEmail).toHaveBeenCalledWith({
			to: email,
			url: expect.any(String),
			userName: name,
		});

		const resetEmail = authMocks.sendPasswordResetEmail.mock.calls[0]?.[0];
		expect(resetEmail).toBeDefined();
		const resetUrl = new URL(resetEmail?.url ?? "");
		expect(resetUrl.origin).toBe(authOrigin);
		expect(resetUrl.pathname).toMatch(/^\/api\/auth\/reset-password\/.+/);
		expect(resetUrl.searchParams.get("callbackURL")).toBe(resetCallback);
		const emailedResetToken = resetUrl.pathname.split("/").at(-1);
		expect(emailedResetToken).toEqual(expect.any(String));

		const resetCallbackResponse = await auth.handler(
			new Request(resetUrl.href, { redirect: "manual" }),
		);
		expect(resetCallbackResponse.status).toBe(302);
		const resetLocation = resetCallbackResponse.headers.get("location");
		expect(resetLocation).not.toBeNull();
		const resetLandingUrl = new URL(resetLocation ?? "", resetUrl);
		expect(resetLandingUrl.pathname).toBe(resetCallback);
		expect(resetLandingUrl.searchParams.get("token")).toBe(emailedResetToken);

		expect(
			await auth.api.resetPassword({
				body: {
					newPassword,
					token: resetLandingUrl.searchParams.get("token") ?? undefined,
				},
			}),
		).toEqual({ status: true });

		const revokedSessionResponse = await auth.handler(
			new Request(`${authOrigin}/api/auth/get-session`, {
				headers: { cookie: verificationSessionCookie ?? "" },
			}),
		);
		expect(await revokedSessionResponse.json()).toBeNull();

		async function signIn(password: string) {
			return auth.handler(
				new Request(`${authOrigin}/api/auth/sign-in/email`, {
					body: JSON.stringify({ email, password }),
					headers: {
						"content-type": "application/json",
						origin: authOrigin,
					},
					method: "POST",
				}),
			);
		}

		const oldPasswordResponse = await signIn(originalPassword);
		expect(oldPasswordResponse.status).toBe(401);
		expect(await oldPasswordResponse.json()).toMatchObject({
			code: "INVALID_EMAIL_OR_PASSWORD",
		});

		const newPasswordResponse = await signIn(newPassword);
		expect(newPasswordResponse.status).toBe(200);
		expect(await newPasswordResponse.json()).toMatchObject({
			token: expect.any(String),
			user: { email, emailVerified: true },
		});
	});
});
