import type { getManagedEventForEdit } from "@/lib/events/queries";

export type ManagedEventFixture = NonNullable<
	Awaited<ReturnType<typeof getManagedEventForEdit>>
>;

export function createManagedEvent(
	overrides: Partial<ManagedEventFixture> = {},
): ManagedEventFixture {
	return {
		canceledAt: null,
		canceledOccurrences: ["2026-11-05"],
		changeRequests: [],
		collaborators: [
			{
				email: "jamie@example.com",
				name: "Jamie Chen",
				userId: "collaborator-jamie",
			},
		],
		description:
			"A weekly meetup for Sacramento developers to learn together and share work in progress.",
		endsAt: new Date("2026-10-15T03:30:00.000Z"),
		eventUrl: "https://example.com/sacramento-typescript",
		id: "00000000-0000-4000-8000-000000000001",
		isOwner: true,
		locationAddress: "828 I Street, Sacramento, CA 95814",
		locationName: "Sacramento Central Library",
		mode: "hybrid",
		occurrenceOverride: null,
		recurrenceCount: null,
		recurrenceEndDate: "2027-02-25",
		recurrenceEndType: "on_date",
		recurrenceFrequency: "week",
		recurrenceInterval: 1,
		recurrenceMonthlyPattern: null,
		recurrenceWeekdays: [4],
		startsAt: new Date("2026-10-15T01:30:00.000Z"),
		status: "approved",
		submittedBy: "storybook-user",
		timezone: "America/Los_Angeles",
		title: "Sacramento TypeScript Weekly",
		...overrides,
	};
}
