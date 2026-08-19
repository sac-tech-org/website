import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(
	new URL("../netlify/database/migrations", import.meta.url),
);

describe("Netlify Database migrations", () => {
	const database = new NetlifyDB({ logger: () => undefined });

	beforeAll(async () => {
		await database.start();
		await database.applyMigrations(migrationsDirectory);
	});

	afterAll(async () => {
		await database.stop();
	});

	it("creates the Better Auth and event tables", async () => {
		const result = await database.query<{ table_name: string }>(
			`SELECT table_name
			 FROM information_schema.tables
			 WHERE table_schema = 'public'
			 ORDER BY table_name`,
		);

		expect(result.rows.map((row) => row.table_name)).toEqual(
			expect.arrayContaining([
				"account",
				"event",
				"session",
				"user",
				"verification",
			]),
		);
	});

	it("defaults new events to pending", async () => {
		await database.exec(`
			INSERT INTO "user" (id, name, email)
			VALUES ('test-user', 'Test Person', 'person@example.com')
		`);
		await database.exec(`
			INSERT INTO "event" (
				submitted_by,
				title,
				description,
				starts_at,
				ends_at,
				mode
			)
			VALUES (
				'test-user',
				'Sacramento Meetup',
				'A community technology event.',
				'2026-09-02T01:00:00Z',
				'2026-09-02T03:00:00Z',
				'in_person'
			)
		`);

		const result = await database.query<{ status: string }>(
			`SELECT status FROM "event" WHERE submitted_by = 'test-user'`,
		);

		expect(result.rows).toEqual([{ status: "pending" }]);
	});

	it("rejects an event whose end is not after its start", async () => {
		await expect(
			database.exec(`
				INSERT INTO "event" (
					title,
					description,
					starts_at,
					ends_at,
					mode
				)
				VALUES (
					'Invalid Meetup',
					'This row should be rejected by Postgres.',
					'2026-09-02T03:00:00Z',
					'2026-09-02T01:00:00Z',
					'online'
				)
			`),
		).rejects.toThrow();
	});
});
