import type { getSubmissionsForUser } from "@/lib/events/queries";

export type SubmissionFixture = Awaited<
	ReturnType<typeof getSubmissionsForUser>
>[number];

export function createSubmission(
	overrides: Partial<SubmissionFixture> = {},
): SubmissionFixture {
	return {
		canceledAt: null,
		canceledOccurrences: [],
		changeRequests: [],
		collaborators: [],
		createdAt: new Date("2026-08-20T18:00:00.000Z"),
		endsAt: new Date("2026-10-15T03:30:00.000Z"),
		id: "storybook-submission",
		isOwner: true,
		moderationNote: null,
		occurrenceOverrides: [],
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
		title: "Sacramento TypeScript Weekly",
		...overrides,
	};
}

export const mixedSubmissions: SubmissionFixture[] = [
	createSubmission({
		canceledOccurrences: ["2026-11-05", "2026-12-24"],
		changeRequests: [
			{
				createdAt: new Date("2026-08-30T18:00:00.000Z"),
				eventId: "storybook-submission",
				id: "pending-change",
				moderationNote: null,
				occurrenceDate: null,
				scope: "series",
				status: "pending",
			},
		],
	}),
	createSubmission({
		changeRequests: [
			{
				createdAt: new Date("2026-08-29T18:00:00.000Z"),
				eventId: "shared-demo-night",
				id: "rejected-change",
				moderationNote: "Please add the venue's accessibility details.",
				occurrenceDate: null,
				scope: "series",
				status: "rejected",
			},
		],
		endsAt: new Date("2026-10-22T03:00:00.000Z"),
		id: "shared-demo-night",
		isOwner: false,
		recurrenceEndDate: null,
		recurrenceEndType: null,
		recurrenceFrequency: null,
		recurrenceInterval: null,
		recurrenceWeekdays: null,
		startsAt: new Date("2026-10-22T01:00:00.000Z"),
		submittedBy: "another-user",
		title: "Sacramento Community Demo Night",
	}),
	createSubmission({
		endsAt: new Date("2026-10-29T03:00:00.000Z"),
		id: "pending-design-meetup",
		moderationNote: null,
		recurrenceEndDate: null,
		recurrenceEndType: null,
		recurrenceFrequency: null,
		recurrenceInterval: null,
		recurrenceWeekdays: null,
		startsAt: new Date("2026-10-29T01:00:00.000Z"),
		status: "pending",
		title: "Design Systems Meetup",
	}),
	createSubmission({
		canceledAt: new Date("2026-08-28T18:00:00.000Z"),
		endsAt: new Date("2026-09-18T03:00:00.000Z"),
		id: "canceled-workshop",
		recurrenceEndDate: null,
		recurrenceEndType: null,
		recurrenceFrequency: null,
		recurrenceInterval: null,
		recurrenceWeekdays: null,
		startsAt: new Date("2026-09-18T01:00:00.000Z"),
		title: "Canceled Accessibility Workshop",
	}),
];
