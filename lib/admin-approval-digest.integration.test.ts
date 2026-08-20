import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(
	new URL("../netlify/database/migrations", import.meta.url),
);
const NOW = new Date("2026-08-20T15:00:00.000Z");
const environmentKeys = ["NETLIFY_DB_DRIVER", "NETLIFY_DB_URL"] as const;
const originalEnvironment = Object.fromEntries(
	environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

describe("approval reminder database queries", () => {
	const database = new NetlifyDB({ logger: () => undefined });
	let db: (typeof import("@/db"))["db"];
	let schema: typeof import("@/db/schema");
	let authSchema: typeof import("@/db/auth-schema");
	let digest: typeof import("@/lib/admin-approval-digest");
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

		await database.applyMigrations(migrationsDirectory);

		({ db } = await import("@/db"));
		schema = await import("@/db/schema");
		authSchema = await import("@/db/auth-schema");
		digest = await import("@/lib/admin-approval-digest");

		const databaseClient: unknown = db.$client;

		if (
			typeof databaseClient === "object" &&
			databaseClient !== null &&
			"end" in databaseClient &&
			typeof databaseClient.end === "function"
		) {
			closeDrizzleClient = databaseClient.end.bind(databaseClient);
		}
	});

	beforeEach(async () => {
		await db.delete(schema.event);
		await db.delete(authSchema.user);
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
			}
		}
	});

	it("returns a bounded, deterministic preview and the full pending count", async () => {
		const pendingIds = Array.from(
			{ length: 12 },
			(_, index) =>
				`10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
		);

		await db.insert(schema.event).values([
			...pendingIds.map((id, index) => ({
				id,
				title: `Pending event ${String(index + 1).padStart(2, "0")}`,
				description: "A pending event used to verify the daily digest query.",
				startsAt:
					index === 0
						? new Date("2020-01-01T18:00:00.000Z")
						: new Date("2026-09-01T18:00:00.000Z"),
				endsAt:
					index === 0
						? new Date("2020-01-01T20:00:00.000Z")
						: new Date("2026-09-01T20:00:00.000Z"),
				timezone: "America/Los_Angeles",
				mode: "online" as const,
				status: "pending" as const,
				createdAt: new Date(
					`2026-08-${String(index === 1 ? 1 : index + 1).padStart(2, "0")}T18:00:00.000Z`,
				),
			})),
			{
				id: "20000000-0000-4000-8000-000000000001",
				title: "Approved event",
				description: "This approved event must not appear in the digest.",
				startsAt: new Date("2026-09-02T18:00:00.000Z"),
				endsAt: new Date("2026-09-02T20:00:00.000Z"),
				mode: "online" as const,
				status: "approved" as const,
				createdAt: new Date("2026-07-01T18:00:00.000Z"),
			},
			{
				id: "20000000-0000-4000-8000-000000000002",
				title: "Rejected event",
				description: "This rejected event must not appear in the digest.",
				startsAt: new Date("2026-09-03T18:00:00.000Z"),
				endsAt: new Date("2026-09-03T20:00:00.000Z"),
				mode: "online" as const,
				status: "rejected" as const,
				createdAt: new Date("2026-07-02T18:00:00.000Z"),
			},
			{
				id: "20000000-0000-4000-8000-000000000003",
				title: "Canceled pending event",
				description: "This canceled event must not appear in the digest.",
				startsAt: new Date("2026-09-04T18:00:00.000Z"),
				endsAt: new Date("2026-09-04T20:00:00.000Z"),
				mode: "online" as const,
				status: "pending" as const,
				canceledAt: new Date("2026-08-19T18:00:00.000Z"),
				createdAt: new Date("2026-07-03T18:00:00.000Z"),
			},
		]);

		const result = await digest.getPendingApprovalDigestData();

		expect(result.pendingCount).toBe(12);
		expect(result.events).toHaveLength(10);
		expect(result.events.map(({ id }) => id)).toEqual(pendingIds.slice(0, 10));
		expect(result.events[0]).toEqual({
			id: pendingIds[0],
			title: "Pending event 01",
			createdAt: new Date("2026-08-01T18:00:00.000Z"),
			startsAt: new Date("2020-01-01T18:00:00.000Z"),
			timezone: "America/Los_Angeles",
		});
	});

	it("selects only effective verified reviewers and returns stable unique emails", async () => {
		await db.insert(authSchema.user).values([
			{
				id: "approver-uppercase-email",
				name: "Approver Uppercase Email",
				email: "Admin@Example.com",
				emailVerified: true,
				role: "approver",
				banned: false,
			},
			{
				id: "approver-duplicate-email",
				name: "Approver Duplicate Email",
				email: "admin@example.com",
				emailVerified: true,
				role: "member, approver ",
				banned: null,
			},
			{
				id: "approver-with-whitespace",
				name: "Approver With Whitespace",
				email: "team@example.com",
				emailVerified: true,
				role: "owner,\tapprover\n,member",
				banned: false,
			},
			{
				id: "expired-ban",
				name: "Expired Ban",
				email: "expired@example.com",
				emailVerified: true,
				role: "approver",
				banned: true,
				banExpires: new Date("2026-08-20T14:59:59.999Z"),
			},
			{
				id: "unbanned-with-date",
				name: "Unbanned With Date",
				email: "unbanned@example.com",
				emailVerified: true,
				role: "approver",
				banned: false,
				banExpires: new Date("2027-01-01T00:00:00.000Z"),
			},
			{
				id: "permanent-ban",
				name: "Permanent Ban",
				email: "permanent-ban@example.com",
				emailVerified: true,
				role: "approver",
				banned: true,
				banExpires: null,
			},
			{
				id: "active-ban",
				name: "Active Ban",
				email: "active-ban@example.com",
				emailVerified: true,
				role: "approver",
				banned: true,
				banExpires: new Date("2026-08-21T15:00:00.000Z"),
			},
			{
				id: "unverified-approver",
				name: "Unverified Approver",
				email: "unverified@example.com",
				emailVerified: false,
				role: "approver",
				banned: false,
			},
			{
				id: "similar-role",
				name: "Similar Role",
				email: "similar@example.com",
				emailVerified: true,
				role: "preapprover,approval-admin",
				banned: false,
			},
			{
				id: "wrong-case-role",
				name: "Wrong Case Role",
				email: "wrong-case@example.com",
				emailVerified: true,
				role: "Approver",
				banned: false,
			},
			{
				id: "admin-only",
				name: "Admin Only",
				email: "admin-only@example.com",
				emailVerified: true,
				role: "admin",
				banned: false,
			},
			{
				id: "admin-approver",
				name: "Admin Approver",
				email: "admin-approver@example.com",
				emailVerified: true,
				role: "admin,approver",
				banned: false,
			},
		]);

		await expect(digest.getApprovalReminderRecipients(NOW)).resolves.toEqual([
			"admin-approver@example.com",
			"admin-only@example.com",
			"admin@example.com",
			"expired@example.com",
			"team@example.com",
			"unbanned@example.com",
		]);
	});
});
