import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const { getCurrentSessionMock, revalidatePathMock } = vi.hoisted(() => ({
	getCurrentSessionMock: vi.fn(),
	revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/session", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/session")>();

	return {
		...actual,
		getCurrentSession: getCurrentSessionMock,
	};
});

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

// Vitest does not resolve the package's `react-server` condition. This marker
// has no runtime behavior in the application, so expose its intended empty
// server build while keeping every application dependency real.
vi.mock("server-only", () => ({}));

const migrationsDirectory = fileURLToPath(
	new URL("../../netlify/database/migrations", import.meta.url),
);
const FIXED_NOW = new Date("2026-08-19T19:00:00.000Z");
const OWNER_ID = "event-owner";
const OTHER_USER_ID = "other-event-owner";
const ADMIN_ID = "event-admin";
const APPROVER_ID = "event-approver";
const PAST_RECURRING_EVENT_ID = "40000000-0000-4000-8000-000000000001";

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

const idleState = { message: "", status: "idle" } as const;

function session(userId: string, role: string | null = null) {
	return { user: { id: userId, role } };
}

interface SubmissionOptions {
	startsAt?: string;
	endsAt?: string;
	recurring?: boolean;
	weekday?: number;
	title: string;
}

function submissionForm({
	startsAt = "2026-09-01T18:00",
	endsAt = "2026-09-01T20:00",
	recurring = false,
	weekday = 2,
	title,
}: SubmissionOptions) {
	const formData = new FormData();
	formData.set("title", title);
	formData.set(
		"description",
		"A detailed Sacramento technology community event for integration testing.",
	);
	formData.set("startsAt", startsAt);
	formData.set("endsAt", endsAt);
	formData.set("mode", "online");
	formData.set("locationName", "");
	formData.set("locationAddress", "");
	formData.set("eventUrl", "https://example.com/sacramento-event");

	if (recurring) {
		formData.set("recurring", "on");
		formData.set("recurrenceFrequency", "week");
		formData.set("recurrenceInterval", "1");
		formData.append("recurrenceWeekdays", String(weekday));
		formData.set("recurrenceEndType", "after_occurrences");
		formData.set("recurrenceCount", "5");
	}

	return formData;
}

function moderationForm(decision: "approved" | "rejected", note = "") {
	const formData = new FormData();
	formData.set("decision", decision);
	formData.set("note", note);
	return formData;
}

function cancellationForm(
	scope: "event" | "occurrence",
	occurrenceDate?: string,
) {
	const formData = new FormData();
	formData.set("scope", scope);

	if (occurrenceDate) {
		formData.set("occurrenceDate", occurrenceDate);
	}

	return formData;
}

describe("event Server Actions and queries", () => {
	const database = new NetlifyDB({ logger: () => undefined });
	let actions: typeof import("@/lib/events/actions");
	let queries: typeof import("@/lib/events/queries");
	let closeDrizzleClient: (() => Promise<void>) | undefined;
	let databaseStarted = false;

	async function findEventId(title: string) {
		const stored = await database.query<{ id: string }>(
			`SELECT id FROM "event" WHERE title = $1`,
			[title],
		);

		if (!stored.rows[0]) {
			throw new Error(`Expected an event titled "${title}" to be stored.`);
		}

		return stored.rows[0].id;
	}

	async function submitOneTimeEvent(title = "One-time Integration Event") {
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		const result = await actions.submitEvent(
			idleState,
			submissionForm({ title }),
		);

		if (result.status !== "success") {
			throw new Error(`Could not seed one-time event: ${result.message}`);
		}

		return findEventId(title);
	}

	async function submitRecurringEvent({
		endsAt = "2026-09-02T20:00",
		startsAt = "2026-09-02T18:00",
		title = "Recurring Integration Series",
		weekday = 3,
	}: {
		endsAt?: string;
		startsAt?: string;
		title?: string;
		weekday?: number;
	} = {}) {
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		const result = await actions.submitEvent(
			idleState,
			submissionForm({
				endsAt,
				recurring: true,
				startsAt,
				title,
				weekday,
			}),
		);

		if (result.status !== "success") {
			throw new Error(`Could not seed recurring event: ${result.message}`);
		}

		return findEventId(title);
	}

	async function approveEvent(eventId: string) {
		getCurrentSessionMock.mockResolvedValue(session(ADMIN_ID, "admin"));
		const result = await actions.moderateEvent(
			eventId,
			idleState,
			moderationForm("approved"),
		);

		if (result.status !== "success") {
			throw new Error(`Could not seed approved event: ${result.message}`);
		}
	}

	async function seedApprovedRecurringEvent() {
		const eventId = await submitRecurringEvent();
		await approveEvent(eventId);
		return eventId;
	}

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
			"sactech-event-action-integration-test-secret";
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.BETTER_AUTH_ALLOWED_HOSTS = "localhost:3000";
		delete process.env.BETTER_AUTH_SCHEMA_GENERATION;

		await database.applyMigrations(migrationsDirectory);
		await database.exec(`
			INSERT INTO "user" (id, name, email, role)
			VALUES
				('${OWNER_ID}', 'Event Owner', 'owner-events@sactech.test', NULL),
				('${OTHER_USER_ID}', 'Other Owner', 'other-events@sactech.test', NULL),
				('${ADMIN_ID}', 'Event Admin', 'admin-events@sactech.test', 'admin'),
				('${APPROVER_ID}', 'Event Approver', 'approver-events@sactech.test', 'approver')
		`);

		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(FIXED_NOW);
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

		actions = await import("@/lib/events/actions");
		queries = await import("@/lib/events/queries");
	});

	beforeEach(async () => {
		getCurrentSessionMock.mockReset();
		revalidatePathMock.mockReset();
		await database.exec(`DELETE FROM "event"`);
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
				vi.useRealTimers();

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

	it("rejects unauthenticated submissions and cancellations before writing", async () => {
		getCurrentSessionMock.mockResolvedValue(null);

		const submission = await actions.submitEvent(
			idleState,
			submissionForm({ title: "Unauthenticated Event" }),
		);
		const cancellation = await actions.cancelEvent(
			"10000000-0000-4000-8000-000000000001",
			idleState,
			cancellationForm("event"),
		);
		const events = await database.query<{ count: number }>(
			`SELECT COUNT(*)::integer AS count FROM "event"`,
		);

		expect(submission).toMatchObject({ status: "error" });
		expect(cancellation).toMatchObject({ status: "error" });
		expect(events.rows).toEqual([{ count: 0 }]);
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});

	it("inserts a one-time event as one pending parent row", async () => {
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const result = await actions.submitEvent(
			idleState,
			submissionForm({ title: "One-time Integration Event" }),
		);
		const stored = await database.query<{
			ends_at: Date;
			id: string;
			starts_at: Date;
			status: string;
			submitted_by: string;
			timezone: string;
		}>(`
			SELECT id, submitted_by, starts_at, ends_at, timezone, status
			FROM "event"
			WHERE title = 'One-time Integration Event'
		`);
		const recurrenceRows = await database.query<{ count: number }>(`
			SELECT COUNT(*)::integer AS count
			FROM "event_recurrence"
			WHERE event_id = '${stored.rows[0]?.id}'
		`);

		expect(result).toMatchObject({ status: "success" });
		expect(stored.rows).toHaveLength(1);
		expect(stored.rows[0]).toMatchObject({
			status: "pending",
			submitted_by: OWNER_ID,
			timezone: "America/Los_Angeles",
		});
		expect(stored.rows[0].starts_at.toISOString()).toBe(
			"2026-09-02T01:00:00.000Z",
		);
		expect(stored.rows[0].ends_at.toISOString()).toBe(
			"2026-09-02T03:00:00.000Z",
		);
		expect(recurrenceRows.rows).toEqual([{ count: 0 }]);
		expect(revalidatePathMock.mock.calls).toEqual([
			["/account"],
			["/admin/events"],
		]);
	});

	it("inserts one recurring parent and one recurrence rule transactionally", async () => {
		await submitOneTimeEvent();
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const result = await actions.submitEvent(
			idleState,
			submissionForm({
				endsAt: "2026-09-02T20:00",
				recurring: true,
				startsAt: "2026-09-02T18:00",
				title: "Recurring Integration Series",
				weekday: 3,
			}),
		);
		const stored = await database.query<{
			end_type: string;
			frequency: string;
			id: string;
			interval: number;
			occurrence_count: number;
			status: string;
			weekdays: number[];
		}>(`
			SELECT
				e.id,
				e.status,
				r.frequency,
				r."interval" AS interval,
				r.weekdays,
				r.end_type,
				r.occurrence_count
			FROM "event" e
			JOIN "event_recurrence" r ON r.event_id = e.id
			WHERE e.title = 'Recurring Integration Series'
		`);
		const pending = await queries.getPendingEvents();
		const account = await queries.getSubmissionsForUser(OWNER_ID);
		const approved = await queries.getApprovedEvents();

		expect(result).toMatchObject({ status: "success" });
		expect(stored.rows).toHaveLength(1);
		expect(stored.rows[0]).toMatchObject({
			end_type: "after_occurrences",
			frequency: "week",
			interval: 1,
			occurrence_count: 5,
			status: "pending",
			weekdays: [3],
		});
		expect(pending.map((event) => event.title)).toEqual([
			"One-time Integration Event",
			"Recurring Integration Series",
		]);
		expect(account.map((event) => event.title).sort()).toEqual([
			"One-time Integration Event",
			"Recurring Integration Series",
		]);
		expect(approved).toEqual([]);
	});

	it("requires a reviewer and lets an approver approve a series only once", async () => {
		const oneTimeEventId = await submitOneTimeEvent();
		const recurringEventId = await submitRecurringEvent();
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const unauthorized = await actions.moderateEvent(
			recurringEventId,
			idleState,
			moderationForm("approved"),
		);
		expect(unauthorized).toMatchObject({ status: "error" });
		expect(revalidatePathMock).not.toHaveBeenCalled();

		getCurrentSessionMock.mockResolvedValue(session(APPROVER_ID, "approver"));
		const approvedResult = await actions.moderateEvent(
			recurringEventId,
			idleState,
			moderationForm("approved"),
		);

		expect(approvedResult).toMatchObject({ status: "success" });
		expect(revalidatePathMock.mock.calls).toEqual([
			["/events"],
			["/account"],
			["/admin/events"],
		]);

		revalidatePathMock.mockClear();
		const repeatedApproval = await actions.moderateEvent(
			recurringEventId,
			idleState,
			moderationForm("approved"),
		);
		const stored = await database.query<{
			recurrence_count: number;
			reviewed_by: string;
			status: string;
		}>(`
			SELECT
				e.status,
				e.reviewed_by,
				COUNT(r.event_id)::integer AS recurrence_count
			FROM "event" e
			LEFT JOIN "event_recurrence" r ON r.event_id = e.id
			WHERE e.id = '${recurringEventId}'
			GROUP BY e.id
		`);
		const publicEvents = await queries.getApprovedEvents();
		const pending = await queries.getPendingEvents();
		const account = await queries.getSubmissionsForUser(OWNER_ID);

		expect(repeatedApproval).toMatchObject({ status: "error" });
		expect(revalidatePathMock).not.toHaveBeenCalled();
		expect(stored.rows).toEqual([
			{
				recurrence_count: 1,
				reviewed_by: APPROVER_ID,
				status: "approved",
			},
		]);
		expect(publicEvents).toHaveLength(1);
		expect(publicEvents[0]).toMatchObject({
			is_recurring: true,
			slug: recurringEventId,
			title: "Recurring Integration Series",
		});
		expect(publicEvents[0].recurrence_rule).toMatchObject({
			endType: "after_occurrences",
			excludedDates: [],
			frequency: "week",
			occurrenceCount: 5,
		});
		expect(pending.map((event) => event.id)).toEqual([oneTimeEventId]);
		expect(account.find((event) => event.id === recurringEventId)?.status).toBe(
			"approved",
		);
	});

	it("rejects a pending event with an account-visible moderation note", async () => {
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		await actions.submitEvent(
			idleState,
			submissionForm({ title: "Rejected Integration Event" }),
		);
		const storedEvent = await database.query<{ id: string }>(`
			SELECT id FROM "event" WHERE title = 'Rejected Integration Event'
		`);
		const rejectedEventId = storedEvent.rows[0].id;
		revalidatePathMock.mockClear();

		getCurrentSessionMock.mockResolvedValue(session(ADMIN_ID, "admin"));
		const result = await actions.moderateEvent(
			rejectedEventId,
			idleState,
			moderationForm(
				"rejected",
				"Please add more information about who should attend.",
			),
		);
		const stored = await database.query<{
			moderation_note: string;
			status: string;
		}>(`
			SELECT status, moderation_note
			FROM "event"
			WHERE id = '${rejectedEventId}'
		`);
		const accountEvent = (await queries.getSubmissionsForUser(OWNER_ID)).find(
			(event) => event.id === rejectedEventId,
		);

		expect(result).toMatchObject({ status: "success" });
		expect(stored.rows).toEqual([
			{
				moderation_note: "Please add more information about who should attend.",
				status: "rejected",
			},
		]);
		expect(accountEvent).toMatchObject({
			moderationNote: "Please add more information about who should attend.",
			status: "rejected",
		});
		expect(
			(await queries.getPendingEvents()).some(
				(event) => event.id === rejectedEventId,
			),
		).toBe(false);
		expect(
			(await queries.getApprovedEvents()).some(
				(event) => event.slug === rejectedEventId,
			),
		).toBe(false);
		expect(revalidatePathMock.mock.calls).toEqual([
			["/events"],
			["/account"],
			["/admin/events"],
		]);
	});

	it("does not let another user cancel an event they do not own", async () => {
		const recurringEventId = await seedApprovedRecurringEvent();
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OTHER_USER_ID));

		const result = await actions.cancelEvent(
			recurringEventId,
			idleState,
			cancellationForm("event"),
		);
		const stored = await database.query<{ canceled_at: Date | null }>(`
			SELECT canceled_at FROM "event" WHERE id = '${recurringEventId}'
		`);

		expect(result).toMatchObject({ status: "error" });
		expect(stored.rows).toEqual([{ canceled_at: null }]);
		expect(await queries.getApprovedEvents()).toHaveLength(1);
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});

	it("lets the owner cancel a one-time event and prevents later moderation", async () => {
		const oneTimeEventId = await submitOneTimeEvent();
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const cancellation = await actions.cancelEvent(
			oneTimeEventId,
			idleState,
			cancellationForm("event"),
		);
		const stored = await database.query<{
			canceled_at: Date;
			canceled_by: string;
			status: string;
		}>(`
			SELECT status, canceled_at, canceled_by
			FROM "event"
			WHERE id = '${oneTimeEventId}'
		`);
		const accountEvent = (await queries.getSubmissionsForUser(OWNER_ID)).find(
			(event) => event.id === oneTimeEventId,
		);

		expect(cancellation).toMatchObject({ status: "success" });
		expect(stored.rows[0]).toMatchObject({
			canceled_by: OWNER_ID,
			status: "pending",
		});
		expect(stored.rows[0].canceled_at).toEqual(FIXED_NOW);
		expect(accountEvent?.canceledAt).toEqual(FIXED_NOW);
		expect(
			(await queries.getPendingEvents()).some(
				(event) => event.id === oneTimeEventId,
			),
		).toBe(false);
		expect(revalidatePathMock.mock.calls).toEqual([
			["/events"],
			["/account"],
			["/admin/events"],
		]);

		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(ADMIN_ID, "admin"));
		const moderation = await actions.moderateEvent(
			oneTimeEventId,
			idleState,
			moderationForm("approved"),
		);
		const unchanged = await database.query<{
			canceled_at: Date;
			status: string;
		}>(`
			SELECT status, canceled_at
			FROM "event"
			WHERE id = '${oneTimeEventId}'
		`);

		expect(moderation).toMatchObject({ status: "error" });
		expect(unchanged.rows).toEqual([
			{ canceled_at: FIXED_NOW, status: "pending" },
		]);
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});

	it("rejects malformed, unscheduled, and past occurrence cancellations", async () => {
		const recurringEventId = await seedApprovedRecurringEvent();
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		await database.exec(`
			INSERT INTO "event" (
				id,
				submitted_by,
				title,
				description,
				starts_at,
				ends_at,
				mode,
				status
			)
			VALUES (
				'${PAST_RECURRING_EVENT_ID}',
				'${OWNER_ID}',
				'Past Recurring Integration Series',
				'A historical recurring event used to test cancellation guards.',
				'2026-08-05T01:00:00Z',
				'2026-08-05T03:00:00Z',
				'online',
				'rejected'
			);
			INSERT INTO "event_recurrence" (
				event_id,
				frequency,
				"interval",
				weekdays,
				end_type
			)
			VALUES (
				'${PAST_RECURRING_EVENT_ID}',
				'week',
				1,
				ARRAY[1],
				'never'
			)
		`);

		const malformed = await actions.cancelEvent(
			recurringEventId,
			idleState,
			cancellationForm("occurrence", "September 9"),
		);
		const unscheduled = await actions.cancelEvent(
			recurringEventId,
			idleState,
			cancellationForm("occurrence", "2026-09-03"),
		);
		const past = await actions.cancelEvent(
			PAST_RECURRING_EVENT_ID,
			idleState,
			cancellationForm("occurrence", "2026-08-10"),
		);
		const cancellations = await database.query<{ count: number }>(
			`SELECT COUNT(*)::integer AS count FROM "event_occurrence_cancellation"`,
		);

		expect(malformed).toMatchObject({ status: "error" });
		expect(unscheduled).toMatchObject({
			message: "That date is not a scheduled occurrence of this event.",
			status: "error",
		});
		expect(past).toMatchObject({
			message: "Past event occurrences cannot be canceled.",
			status: "error",
		});
		expect(cancellations.rows).toEqual([{ count: 0 }]);
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});

	it("stores one valid occurrence cancellation and rejects a duplicate", async () => {
		const recurringEventId = await seedApprovedRecurringEvent();
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const result = await actions.cancelEvent(
			recurringEventId,
			idleState,
			cancellationForm("occurrence", "2026-09-09"),
		);
		const stored = await database.query<{
			canceled_by: string;
			event_id: string;
			occurrence_date: Date;
		}>(`
			SELECT event_id, occurrence_date, canceled_by
			FROM "event_occurrence_cancellation"
			WHERE event_id = '${recurringEventId}'
		`);
		const publicEvent = (await queries.getApprovedEvents())[0];
		const accountEvent = (await queries.getSubmissionsForUser(OWNER_ID)).find(
			(event) => event.id === recurringEventId,
		);

		expect(result).toMatchObject({ status: "success" });
		expect(stored.rows).toHaveLength(1);
		expect(stored.rows[0]).toMatchObject({
			canceled_by: OWNER_ID,
			event_id: recurringEventId,
		});
		expect(stored.rows[0].occurrence_date.toISOString()).toBe(
			"2026-09-09T00:00:00.000Z",
		);
		expect(publicEvent.recurrence_rule?.excludedDates).toEqual(["2026-09-09"]);
		expect(accountEvent?.canceledOccurrences).toEqual(["2026-09-09"]);
		expect(revalidatePathMock.mock.calls).toEqual([
			["/events"],
			["/account"],
			["/admin/events"],
		]);

		revalidatePathMock.mockClear();
		const duplicate = await actions.cancelEvent(
			recurringEventId,
			idleState,
			cancellationForm("occurrence", "2026-09-09"),
		);
		const count = await database.query<{ count: number }>(`
			SELECT COUNT(*)::integer AS count
			FROM "event_occurrence_cancellation"
			WHERE event_id = '${recurringEventId}'
		`);

		expect(duplicate).toMatchObject({
			message: "That event occurrence is already canceled.",
			status: "error",
		});
		expect(count.rows).toEqual([{ count: 1 }]);
		expect(revalidatePathMock).not.toHaveBeenCalled();
	});

	it("shows pending exceptions to admins and the event owner", async () => {
		const pendingRecurringEventId = await submitRecurringEvent({
			endsAt: "2026-09-03T20:00",
			startsAt: "2026-09-03T18:00",
			title: "Pending Recurring Integration Series",
			weekday: 4,
		});
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const cancellation = await actions.cancelEvent(
			pendingRecurringEventId,
			idleState,
			cancellationForm("occurrence", "2026-09-10"),
		);
		const pendingEvent = (await queries.getPendingEvents()).find(
			(event) => event.id === pendingRecurringEventId,
		);
		const accountEvent = (await queries.getSubmissionsForUser(OWNER_ID)).find(
			(event) => event.id === pendingRecurringEventId,
		);

		expect(cancellation).toMatchObject({ status: "success" });
		expect(pendingEvent?.canceledOccurrences).toEqual(["2026-09-10"]);
		expect(accountEvent?.canceledOccurrences).toEqual(["2026-09-10"]);
	});

	it("immediately hides a whole canceled series without changing its approval", async () => {
		const recurringEventId = await seedApprovedRecurringEvent();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		const exception = await actions.cancelEvent(
			recurringEventId,
			idleState,
			cancellationForm("occurrence", "2026-09-09"),
		);

		if (exception.status !== "success") {
			throw new Error(
				`Could not seed occurrence exception: ${exception.message}`,
			);
		}

		const pendingRecurringEventId = await submitRecurringEvent({
			endsAt: "2026-09-03T20:00",
			startsAt: "2026-09-03T18:00",
			title: "Pending Recurring Integration Series",
			weekday: 4,
		});
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const result = await actions.cancelEvent(
			recurringEventId,
			idleState,
			cancellationForm("event"),
		);
		const stored = await database.query<{
			canceled_at: Date;
			canceled_by: string;
			status: string;
		}>(`
			SELECT status, canceled_at, canceled_by
			FROM "event"
			WHERE id = '${recurringEventId}'
		`);
		const publicEvents = await queries.getApprovedEvents();
		const pending = await queries.getPendingEvents();
		const accountEvent = (await queries.getSubmissionsForUser(OWNER_ID)).find(
			(event) => event.id === recurringEventId,
		);

		expect(result).toMatchObject({ status: "success" });
		expect(stored.rows[0]).toMatchObject({
			canceled_by: OWNER_ID,
			status: "approved",
		});
		expect(stored.rows[0].canceled_at).toEqual(FIXED_NOW);
		expect(publicEvents).toEqual([]);
		expect(pending.map((event) => event.id)).toEqual([pendingRecurringEventId]);
		expect(accountEvent?.canceledAt).toEqual(FIXED_NOW);
		expect(accountEvent?.canceledOccurrences).toEqual(["2026-09-09"]);
		expect(revalidatePathMock.mock.calls).toEqual([
			["/events"],
			["/account"],
			["/admin/events"],
		]);
	});
});
