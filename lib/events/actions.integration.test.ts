import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { testDatabase as database } from "@/test-support/database-client";

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

const FIXED_NOW = new Date("2026-08-19T19:00:00.000Z");
const OWNER_ID = "event-owner";
const OTHER_USER_ID = "other-event-owner";
const OUTSIDER_ID = "event-outsider";
const ADMIN_ID = "event-admin";
const APPROVER_ID = "event-approver";
const PAST_RECURRING_EVENT_ID = "40000000-0000-4000-8000-000000000001";

const environmentKeys = [
	"BETTER_AUTH_ALLOWED_HOSTS",
	"BETTER_AUTH_SCHEMA_GENERATION",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
] as const;
const originalEnvironment = Object.fromEntries(
	environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

const idleState = { message: "", status: "idle" } as const;

function session(userId: string, role: string | null = null) {
	return { user: { id: userId, role } };
}

interface SubmissionOptions {
	description?: string;
	startsAt?: string;
	endsAt?: string;
	recurring?: boolean;
	weekday?: number;
	title: string;
}

function submissionForm({
	description = "A detailed Sacramento technology community event for integration testing.",
	startsAt = "2026-09-01T18:00",
	endsAt = "2026-09-01T20:00",
	recurring = false,
	weekday = 2,
	title,
}: SubmissionOptions) {
	const formData = new FormData();
	formData.set("title", title);
	formData.set("description", description);
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

function collaboratorForm(email: string) {
	const formData = new FormData();
	formData.set("email", email);
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
	let actions: typeof import("@/lib/events/actions");
	let queries: typeof import("@/lib/events/queries");
	let closeDrizzleClient: (() => Promise<void>) | undefined;

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
		process.env.BETTER_AUTH_SECRET =
			"sactech-event-action-integration-test-secret";
		process.env.BETTER_AUTH_URL = "http://localhost:3000";
		process.env.BETTER_AUTH_ALLOWED_HOSTS = "localhost:3000";
		delete process.env.BETTER_AUTH_SCHEMA_GENERATION;

		await database.exec(`
			INSERT INTO "user" (id, name, email, role)
			VALUES
				('${OWNER_ID}', 'Event Owner', 'owner-events@sactech.test', NULL),
				('${OTHER_USER_ID}', 'Other Owner', 'other-events@sactech.test', 'submitter'),
				('${OUTSIDER_ID}', 'Event Outsider', 'outsider-events@sactech.test', 'submitter'),
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

	it("lets only the original submitter invite an existing submit-capable collaborator", async () => {
		const eventId = await submitOneTimeEvent("Shared Integration Event");
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OUTSIDER_ID));

		const denied = await actions.inviteEventCollaborator(
			eventId,
			idleState,
			collaboratorForm("admin-events@sactech.test"),
		);
		const beforeInvite = await database.query<{ count: number }>(`
			SELECT COUNT(*)::integer AS count
			FROM "event_collaborator"
			WHERE event_id = '${eventId}'
		`);

		expect(denied).toMatchObject({
			message: "Only the original submitter can invite event editors.",
			status: "error",
		});
		expect(beforeInvite.rows).toEqual([{ count: 0 }]);
		expect(revalidatePathMock).not.toHaveBeenCalled();

		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		const invited = await actions.inviteEventCollaborator(
			eventId,
			idleState,
			collaboratorForm("OTHER-EVENTS@SACTECH.TEST"),
		);
		const stored = await database.query<{
			event_id: string;
			invited_by: string;
			user_id: string;
		}>(`
			SELECT event_id, user_id, invited_by
			FROM "event_collaborator"
			WHERE event_id = '${eventId}'
		`);
		const collaboratorEvent = (
			await queries.getSubmissionsForUser(OTHER_USER_ID)
		).find((candidate) => candidate.id === eventId);
		const ownerEvent = (await queries.getSubmissionsForUser(OWNER_ID)).find(
			(candidate) => candidate.id === eventId,
		);

		expect(invited).toMatchObject({ status: "success" });
		expect(stored.rows).toEqual([
			{
				event_id: eventId,
				invited_by: OWNER_ID,
				user_id: OTHER_USER_ID,
			},
		]);
		expect(collaboratorEvent).toMatchObject({
			id: eventId,
			isOwner: false,
			title: "Shared Integration Event",
		});
		expect(ownerEvent).toMatchObject({
			collaborators: [
				{
					email: "other-events@sactech.test",
					userId: OTHER_USER_ID,
				},
			],
			isOwner: true,
		});
		expect(revalidatePathMock.mock.calls).toEqual([
			["/account"],
			[`/events/${eventId}/edit`],
		]);
	});

	it("lets an invited collaborator cancel the event", async () => {
		const eventId = await seedApprovedRecurringEvent();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		const invitation = await actions.inviteEventCollaborator(
			eventId,
			idleState,
			collaboratorForm("other-events@sactech.test"),
		);

		if (invitation.status !== "success") {
			throw new Error(`Could not seed collaborator: ${invitation.message}`);
		}

		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OTHER_USER_ID));
		const cancellation = await actions.cancelEvent(
			eventId,
			idleState,
			cancellationForm("event"),
		);
		const stored = await database.query<{
			canceled_at: Date;
			canceled_by: string;
		}>(`
			SELECT canceled_at, canceled_by
			FROM "event"
			WHERE id = '${eventId}'
		`);

		expect(cancellation).toMatchObject({ status: "success" });
		expect(stored.rows).toEqual([
			{ canceled_at: FIXED_NOW, canceled_by: OTHER_USER_ID },
		]);
		expect(await queries.getApprovedEvents()).toEqual([]);
		expect(revalidatePathMock.mock.calls).toEqual([
			["/events"],
			["/account"],
			["/admin/events"],
		]);
	});

	it("keeps an approved series edit pending until an approver publishes it", async () => {
		const eventId = await seedApprovedRecurringEvent();
		const updatedDescription =
			"An approved replacement description for the complete recurring series.";
		revalidatePathMock.mockClear();
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const requested = await actions.requestEventEdit(
			eventId,
			"series",
			null,
			idleState,
			submissionForm({
				description: updatedDescription,
				endsAt: "2026-09-02T20:00",
				recurring: true,
				startsAt: "2026-09-02T18:00",
				title: "Updated Recurring Integration Series",
				weekday: 3,
			}),
		);
		const liveBeforeReview = await database.query<{
			content_version: number;
			description: string;
			title: string;
		}>(`
			SELECT content_version, description, title
			FROM "event"
			WHERE id = '${eventId}'
		`);
		const pendingChanges = await database.query<{
			id: string;
			proposed_by: string;
			scope: string;
			status: string;
			title: string;
		}>(`
			SELECT id, proposed_by, scope, status, title
			FROM "event_change_request"
			WHERE event_id = '${eventId}'
		`);
		const publicBeforeReview = (await queries.getApprovedEvents())[0];

		expect(requested).toMatchObject({ status: "success" });
		expect(liveBeforeReview.rows).toEqual([
			{
				content_version: 1,
				description:
					"A detailed Sacramento technology community event for integration testing.",
				title: "Recurring Integration Series",
			},
		]);
		expect(pendingChanges.rows).toHaveLength(1);
		expect(pendingChanges.rows[0]).toMatchObject({
			proposed_by: OWNER_ID,
			scope: "series",
			status: "pending",
			title: "Updated Recurring Integration Series",
		});
		expect(publicBeforeReview).toMatchObject({
			description:
				"A detailed Sacramento technology community event for integration testing.",
			title: "Recurring Integration Series",
		});

		const duplicate = await actions.requestEventEdit(
			eventId,
			"series",
			null,
			idleState,
			submissionForm({
				endsAt: "2026-09-02T20:00",
				recurring: true,
				startsAt: "2026-09-02T18:00",
				title: "Second Pending Series Edit",
				weekday: 3,
			}),
		);
		const pendingCount = await database.query<{ count: number }>(`
			SELECT COUNT(*)::integer AS count
			FROM "event_change_request"
			WHERE event_id = '${eventId}' AND status = 'pending'
		`);

		expect(duplicate).toMatchObject({
			message: "This series already has changes waiting for review.",
			status: "error",
		});
		expect(pendingCount.rows).toEqual([{ count: 1 }]);

		getCurrentSessionMock.mockResolvedValue(session(APPROVER_ID, "approver"));
		const approved = await actions.moderateEventEdit(
			pendingChanges.rows[0].id,
			idleState,
			moderationForm("approved"),
		);
		const liveAfterReview = await database.query<{
			content_version: number;
			description: string;
			title: string;
		}>(`
			SELECT content_version, description, title
			FROM "event"
			WHERE id = '${eventId}'
		`);
		const reviewed = await database.query<{
			reviewed_by: string;
			status: string;
		}>(`
			SELECT reviewed_by, status
			FROM "event_change_request"
			WHERE id = '${pendingChanges.rows[0].id}'
		`);
		const publicAfterReview = (await queries.getApprovedEvents())[0];

		expect(approved).toMatchObject({ status: "success" });
		expect(liveAfterReview.rows).toEqual([
			{
				content_version: 2,
				description: updatedDescription,
				title: "Updated Recurring Integration Series",
			},
		]);
		expect(reviewed.rows).toEqual([
			{ reviewed_by: APPROVER_ID, status: "approved" },
		]);
		expect(publicAfterReview).toMatchObject({
			description: updatedDescription,
			title: "Updated Recurring Integration Series",
		});
	});

	it("publishes one approved occurrence override and excludes its generated base date", async () => {
		const eventId = await seedApprovedRecurringEvent();
		const occurrenceDate = "2026-09-09";
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));

		const requested = await actions.requestEventEdit(
			eventId,
			"occurrence",
			occurrenceDate,
			idleState,
			submissionForm({
				description:
					"This single session has a special speaker and updated event details.",
				endsAt: "2026-09-09T21:00",
				startsAt: "2026-09-09T19:00",
				title: "Special Recurring Session",
			}),
		);
		const [pendingChange] = (
			await database.query<{ id: string }>(`
				SELECT id
				FROM "event_change_request"
				WHERE event_id = '${eventId}' AND occurrence_date = '${occurrenceDate}'
			`)
		).rows;
		const publicBeforeReview = (await queries.getApprovedEvents())[0];

		expect(requested).toMatchObject({ status: "success" });
		expect(pendingChange).toBeDefined();
		expect(publicBeforeReview.blocks).toHaveLength(1);
		expect(publicBeforeReview.recurrence_rule?.excludedDates).toEqual([]);

		getCurrentSessionMock.mockResolvedValue(session(ADMIN_ID, "admin"));
		const approved = await actions.moderateEventEdit(
			pendingChange.id,
			idleState,
			moderationForm("approved"),
		);
		const overrides = await database.query<{
			approved_change_id: string;
			event_id: string;
			occurrence_date: string;
			title: string;
			version: number;
		}>(`
			SELECT
				event_id,
				occurrence_date::text AS occurrence_date,
				approved_change_id,
				title,
				version
			FROM "event_occurrence_override"
			WHERE event_id = '${eventId}'
		`);
		const liveEvent = await database.query<{ title: string }>(`
			SELECT title FROM "event" WHERE id = '${eventId}'
		`);
		const publicAfterReview = (await queries.getApprovedEvents())[0];
		const datedBlocks = publicAfterReview.blocks.filter(
			(block) => block.recurrence_date === occurrenceDate,
		);

		expect(approved).toMatchObject({ status: "success" });
		expect(overrides.rows).toEqual([
			{
				approved_change_id: pendingChange.id,
				event_id: eventId,
				occurrence_date: occurrenceDate,
				title: "Special Recurring Session",
				version: 1,
			},
		]);
		expect(liveEvent.rows).toEqual([{ title: "Recurring Integration Series" }]);
		expect(publicAfterReview.title).toBe("Recurring Integration Series");
		expect(publicAfterReview.recurrence_rule?.excludedDates).toEqual([
			occurrenceDate,
		]);
		expect(datedBlocks).toHaveLength(1);
		expect(datedBlocks[0]).toMatchObject({
			recurrence_date: occurrenceDate,
			title: "Special Recurring Session",
		});
	});

	it("keeps the live event unchanged when an approved-event edit is rejected", async () => {
		const eventId = await submitOneTimeEvent("Live Event Before Rejected Edit");
		await approveEvent(eventId);
		getCurrentSessionMock.mockResolvedValue(session(OWNER_ID));
		const requested = await actions.requestEventEdit(
			eventId,
			"series",
			null,
			idleState,
			submissionForm({
				description:
					"This proposed replacement should never become public after rejection.",
				title: "Rejected Replacement Title",
			}),
		);
		const [pendingChange] = (
			await database.query<{ id: string }>(`
				SELECT id
				FROM "event_change_request"
				WHERE event_id = '${eventId}' AND status = 'pending'
			`)
		).rows;

		expect(requested).toMatchObject({ status: "success" });
		expect(pendingChange).toBeDefined();

		getCurrentSessionMock.mockResolvedValue(session(APPROVER_ID, "approver"));
		const rejected = await actions.moderateEventEdit(
			pendingChange.id,
			idleState,
			moderationForm(
				"rejected",
				"Please keep the original title for this event.",
			),
		);
		const live = await database.query<{
			content_version: number;
			description: string;
			title: string;
		}>(`
			SELECT content_version, description, title
			FROM "event"
			WHERE id = '${eventId}'
		`);
		const change = await database.query<{
			moderation_note: string;
			reviewed_by: string;
			status: string;
		}>(`
			SELECT moderation_note, reviewed_by, status
			FROM "event_change_request"
			WHERE id = '${pendingChange.id}'
		`);
		const publicEvent = (await queries.getApprovedEvents())[0];

		expect(rejected).toMatchObject({ status: "success" });
		expect(live.rows).toEqual([
			{
				content_version: 1,
				description:
					"A detailed Sacramento technology community event for integration testing.",
				title: "Live Event Before Rejected Edit",
			},
		]);
		expect(change.rows).toEqual([
			{
				moderation_note: "Please keep the original title for this event.",
				reviewed_by: APPROVER_ID,
				status: "rejected",
			},
		]);
		expect(publicEvent).toMatchObject({
			description:
				"A detailed Sacramento technology community event for integration testing.",
			title: "Live Event Before Rejected Edit",
		});
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
			occurrence_date: string;
		}>(`
			SELECT
				event_id,
				occurrence_date::text AS occurrence_date,
				canceled_by
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
		expect(stored.rows[0].occurrence_date).toBe("2026-09-09");
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
