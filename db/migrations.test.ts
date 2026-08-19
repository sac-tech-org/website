import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(
	new URL("../netlify/database/migrations", import.meta.url),
);

describe("Netlify Database migrations", () => {
	const database = new NetlifyDB({ logger: () => undefined });
	const insertEvent = (id: string, title: string) =>
		database.exec(`
			INSERT INTO "event" (
				id,
				title,
				description,
				starts_at,
				ends_at,
				mode
			)
			VALUES (
				'${id}',
				'${title}',
				'A recurring community technology event.',
				'2026-09-02T01:00:00Z',
				'2026-09-02T03:00:00Z',
				'online'
			)
		`);

	beforeAll(async () => {
		await database.start();
		await database.applyMigrations(migrationsDirectory);
	});

	afterAll(async () => {
		await database.stop();
	});

	it("creates the Better Auth, event, recurrence, and cancellation tables", async () => {
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
				"event_occurrence_cancellation",
				"event_recurrence",
				"session",
				"user",
				"verification",
			]),
		);
	});

	it("adds event-series cancellation columns", async () => {
		const result = await database.query<{
			column_name: string;
			data_type: string;
			is_nullable: string;
		}>(`
			SELECT column_name, data_type, is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'event'
				AND column_name IN ('canceled_at', 'canceled_by')
			ORDER BY column_name
		`);

		expect(result.rows).toEqual([
			{
				column_name: "canceled_at",
				data_type: "timestamp with time zone",
				is_nullable: "YES",
			},
			{
				column_name: "canceled_by",
				data_type: "text",
				is_nullable: "YES",
			},
		]);
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

	it("stores one recurrence per event and cascades it on event deletion", async () => {
		const eventId = "10000000-0000-4000-8000-000000000001";
		await insertEvent(eventId, "Recurring Sacramento Meetup");
		await database.exec(`
			INSERT INTO "event_recurrence" (
				event_id,
				frequency,
				"interval",
				weekdays,
				end_type,
				occurrence_count
			)
			VALUES (
				'${eventId}',
				'week',
				2,
				ARRAY[2, 4],
				'after_occurrences',
				6
			)
		`);

		const stored = await database.query<{
			end_type: string;
			frequency: string;
			interval: number;
			occurrence_count: number;
			weekdays: number[];
		}>(`
			SELECT frequency, "interval", weekdays, end_type, occurrence_count
			FROM "event_recurrence"
			WHERE event_id = '${eventId}'
		`);

		expect(stored.rows).toEqual([
			{
				end_type: "after_occurrences",
				frequency: "week",
				interval: 2,
				occurrence_count: 6,
				weekdays: [2, 4],
			},
		]);

		await expect(
			database.exec(`
				INSERT INTO "event_recurrence" (
					event_id,
					frequency,
					"interval",
					end_type
				)
				VALUES ('${eventId}', 'day', 1, 'never')
			`),
		).rejects.toThrow();

		await database.exec(`DELETE FROM "event" WHERE id = '${eventId}'`);

		const remaining = await database.query<{ count: number }>(`
			SELECT COUNT(*)::integer AS count
			FROM "event_recurrence"
			WHERE event_id = '${eventId}'
		`);

		expect(remaining.rows).toEqual([{ count: 0 }]);
	});

	it("rejects inconsistent recurrence rules", async () => {
		const eventId = "10000000-0000-4000-8000-000000000002";
		await insertEvent(eventId, "Recurrence Constraint Test");

		interface RecurrenceSqlValues {
			endDate: string;
			endType: string;
			frequency: string;
			interval: string;
			monthlyPattern: string;
			occurrenceCount: string;
			weekdays: string;
		}

		const insertRecurrence = (
			overrides: Partial<RecurrenceSqlValues> = {},
		) => {
			const values: RecurrenceSqlValues = {
				endDate: "NULL",
				endType: "'never'",
				frequency: "'day'",
				interval: "1",
				monthlyPattern: "NULL",
				occurrenceCount: "NULL",
				weekdays: "NULL",
				...overrides,
			};

			return database.exec(`
				INSERT INTO "event_recurrence" (
					event_id,
					frequency,
					"interval",
					weekdays,
					monthly_pattern,
					end_type,
					end_date,
					occurrence_count
				)
				VALUES (
					'${eventId}',
					${values.frequency},
					${values.interval},
					${values.weekdays},
					${values.monthlyPattern},
					${values.endType},
					${values.endDate},
					${values.occurrenceCount}
				)
			`);
		};

		const invalidRecurrences = [
			["an interval below one", { interval: "0" }],
			["an interval above 99", { interval: "100" }],
			["a weekly rule without weekdays", { frequency: "'week'" }],
			[
				"an empty weekly weekdays array",
				{ frequency: "'week'", weekdays: "ARRAY[]::integer[]" },
			],
			[
				"a weekly weekday outside Sunday through Saturday",
				{ frequency: "'week'", weekdays: "ARRAY[7]" },
			],
			[
				"a null entry in weekly weekdays",
				{ frequency: "'week'", weekdays: "ARRAY[1, NULL]" },
			],
			[
				"a multidimensional weekly weekdays array",
				{ frequency: "'week'", weekdays: "ARRAY[[1, 2], [3, 4]]" },
			],
			["weekdays on a non-weekly rule", { weekdays: "ARRAY[1]" }],
			["a monthly rule without a pattern", { frequency: "'month'" }],
			[
				"a monthly pattern on a non-monthly rule",
				{ monthlyPattern: "'day_of_month'" },
			],
			["an on-date ending without a date", { endType: "'on_date'" }],
			[
				"an occurrence count on an on-date ending",
				{
					endDate: "'2026-12-31'",
					endType: "'on_date'",
					occurrenceCount: "4",
				},
			],
			[
				"an end date on a never-ending rule",
				{ endDate: "'2026-12-31'" },
			],
			[
				"an after-occurrences ending without a count",
				{ endType: "'after_occurrences'" },
			],
			[
				"an occurrence count below two",
				{ endType: "'after_occurrences'", occurrenceCount: "1" },
			],
			[
				"an occurrence count above 1000",
				{ endType: "'after_occurrences'", occurrenceCount: "1001" },
			],
			[
				"an end date on an after-occurrences ending",
				{
					endDate: "'2026-12-31'",
					endType: "'after_occurrences'",
					occurrenceCount: "4",
				},
			],
		] satisfies [string, Partial<RecurrenceSqlValues>][];

		for (const [description, values] of invalidRecurrences) {
			await expect(insertRecurrence(values), description).rejects.toThrow();
		}

		await database.exec(`DELETE FROM "event" WHERE id = '${eventId}'`);
	});

	it("stores one cancellation per event occurrence and cascades on event deletion", async () => {
		const eventId = "10000000-0000-4000-8000-000000000003";
		await insertEvent(eventId, "Occurrence Cancellation Test");
		await database.exec(`
			INSERT INTO "event_occurrence_cancellation" (
				event_id,
				occurrence_date
			)
			VALUES ('${eventId}', '2026-09-08')
		`);

		await expect(
			database.exec(`
				INSERT INTO "event_occurrence_cancellation" (
					event_id,
					occurrence_date
				)
				VALUES ('${eventId}', '2026-09-08')
			`),
		).rejects.toThrow();

		await database.exec(`DELETE FROM "event" WHERE id = '${eventId}'`);

		const remaining = await database.query<{ count: number }>(`
			SELECT COUNT(*)::integer AS count
			FROM "event_occurrence_cancellation"
			WHERE event_id = '${eventId}'
		`);

		expect(remaining.rows).toEqual([{ count: 0 }]);
	});
});
