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
	"NETLIFY_DB_DRIVER",
	"NETLIFY_DB_URL",
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
		const databaseUrl = await database.start();
		databaseStarted = true;

		process.env.NETLIFY_DB_URL = databaseUrl;
		process.env.NETLIFY_DB_DRIVER = "server";
		process.env.BETTER_AUTH_SECRET =
			"sactech-better-auth-integration-test-secret";
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.BETTER_AUTH_ALLOWED_HOSTS = "localhost:3000";
		delete process.env.BETTER_AUTH_SCHEMA_GENERATION;

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
