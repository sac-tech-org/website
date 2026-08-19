import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
	"NETLIFY",
	"NETLIFY_DB_DRIVER",
	"NETLIFY_DB_URL",
	"SITE_ID",
	"SITE_NAME",
	"URL",
] as const;

const originalEnvironment = Object.fromEntries(
	environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

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
		}>(
			`SELECT id, name, email, email_verified
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
});
