import { testDatabase as database } from "@/test-support/database-client";
import { describe, expect, it } from "vitest";

describe("Database schema contract", () => {
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

	const insertChangeRequest = ({
		eventId,
		id,
		occurrenceDate = null,
		scope,
		status = "pending",
		title,
	}: {
		eventId: string;
		id: string;
		occurrenceDate?: string | null;
		scope: "occurrence" | "series";
		status?: "approved" | "pending" | "rejected";
		title: string;
	}) =>
		database.exec(`
			INSERT INTO "event_change_request" (
				id,
				event_id,
				scope,
				occurrence_date,
				base_content_version,
				title,
				description,
				starts_at,
				ends_at,
				mode,
				status
			)
			VALUES (
				'${id}',
				'${eventId}',
				'${scope}',
				${occurrenceDate ? `'${occurrenceDate}'` : "NULL"},
				1,
				'${title}',
				'A complete proposed event snapshot for schema testing.',
				'2026-09-09T01:00:00Z',
				'2026-09-09T03:00:00Z',
				'online',
				'${status}'
			)
		`);

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

		const result = await database.query<{
			content_version: number;
			status: string;
		}>(
			`SELECT status, content_version FROM "event" WHERE submitted_by = 'test-user'`,
		);

		expect(result.rows).toEqual([{ content_version: 1, status: "pending" }]);
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

		const insertRecurrence = (overrides: Partial<RecurrenceSqlValues> = {}) => {
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
			["an end date on a never-ending rule", { endDate: "'2026-12-31'" }],
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

	it("allows only one pending edit for each series or occurrence target", async () => {
		const eventId = "50000000-0000-4000-8000-000000000001";
		await insertEvent(eventId, "Pending Edit Target Constraint Test");
		await insertChangeRequest({
			eventId,
			id: "51000000-0000-4000-8000-000000000001",
			scope: "series",
			title: "First Pending Series Snapshot",
		});

		await expect(
			insertChangeRequest({
				eventId,
				id: "51000000-0000-4000-8000-000000000002",
				scope: "series",
				title: "Duplicate Pending Series Snapshot",
			}),
		).rejects.toThrow();

		await insertChangeRequest({
			eventId,
			id: "51000000-0000-4000-8000-000000000003",
			scope: "series",
			status: "rejected",
			title: "Retained Rejected Series History",
		});
		await insertChangeRequest({
			eventId,
			id: "51000000-0000-4000-8000-000000000004",
			occurrenceDate: "2026-09-09",
			scope: "occurrence",
			title: "First Pending Occurrence Snapshot",
		});

		await expect(
			insertChangeRequest({
				eventId,
				id: "51000000-0000-4000-8000-000000000005",
				occurrenceDate: "2026-09-09",
				scope: "occurrence",
				title: "Duplicate Pending Occurrence Snapshot",
			}),
		).rejects.toThrow();

		await insertChangeRequest({
			eventId,
			id: "51000000-0000-4000-8000-000000000006",
			occurrenceDate: "2026-09-16",
			scope: "occurrence",
			title: "Different Pending Occurrence Snapshot",
		});

		const stored = await database.query<{
			count: number;
			scope: string;
			status: string;
		}>(`
			SELECT scope, status, COUNT(*)::integer AS count
			FROM "event_change_request"
			WHERE event_id = '${eventId}'
			GROUP BY scope, status
			ORDER BY scope, status
		`);

		expect(stored.rows).toEqual([
			{ count: 1, scope: "series", status: "pending" },
			{ count: 1, scope: "series", status: "rejected" },
			{ count: 2, scope: "occurrence", status: "pending" },
		]);

		await database.exec(`DELETE FROM "event" WHERE id = '${eventId}'`);
	});

	it("uniquely stores collaborators and occurrence overrides and cascades workflow rows", async () => {
		const eventId = "50000000-0000-4000-8000-000000000002";
		const changeId = "52000000-0000-4000-8000-000000000001";
		await database.exec(`
			INSERT INTO "user" (id, name, email, role)
			VALUES (
				'schema-event-collaborator',
				'Schema Collaborator',
				'schema-collaborator@example.com',
				'submitter'
			)
		`);
		await insertEvent(eventId, "Workflow Cascade Contract Test");
		await database.exec(`
			INSERT INTO "event_collaborator" (event_id, user_id)
			VALUES ('${eventId}', 'schema-event-collaborator')
		`);

		await expect(
			database.exec(`
				INSERT INTO "event_collaborator" (event_id, user_id)
				VALUES ('${eventId}', 'schema-event-collaborator')
			`),
		).rejects.toThrow();

		await insertChangeRequest({
			eventId,
			id: changeId,
			occurrenceDate: "2026-09-09",
			scope: "occurrence",
			status: "approved",
			title: "Approved Override Source Snapshot",
		});
		await database.exec(`
			INSERT INTO "event_occurrence_override" (
				event_id,
				occurrence_date,
				approved_change_id,
				title,
				description,
				starts_at,
				ends_at,
				mode
			)
			VALUES (
				'${eventId}',
				'2026-09-09',
				'${changeId}',
				'Approved Occurrence Override',
				'An approved occurrence override used for schema testing.',
				'2026-09-09T02:00:00Z',
				'2026-09-09T04:00:00Z',
				'online'
			)
		`);

		await expect(
			database.exec(`
				INSERT INTO "event_occurrence_override" (
					event_id,
					occurrence_date,
					title,
					description,
					starts_at,
					ends_at,
					mode
				)
				VALUES (
					'${eventId}',
					'2026-09-09',
					'Duplicate Occurrence Override',
					'This duplicate occurrence override should be rejected.',
					'2026-09-09T02:00:00Z',
					'2026-09-09T04:00:00Z',
					'online'
				)
			`),
		).rejects.toThrow();

		await database.exec(`DELETE FROM "event" WHERE id = '${eventId}'`);

		const remaining = await database.query<{
			change_requests: number;
			collaborators: number;
			overrides: number;
		}>(`
			SELECT
				(SELECT COUNT(*)::integer FROM "event_change_request" WHERE event_id = '${eventId}') AS change_requests,
				(SELECT COUNT(*)::integer FROM "event_collaborator" WHERE event_id = '${eventId}') AS collaborators,
				(SELECT COUNT(*)::integer FROM "event_occurrence_override" WHERE event_id = '${eventId}') AS overrides
		`);

		expect(remaining.rows).toEqual([
			{ change_requests: 0, collaborators: 0, overrides: 0 },
		]);
	});
});
