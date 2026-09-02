import preview from "@/.storybook/preview";
import EditEventPage from "@/app/events/[eventId]/edit/page";
import { getManagedEventForEdit } from "@/lib/events/queries";
import { requireSession } from "@/lib/session";
import { createSession } from "@/stories/fixtures/auth";
import { createManagedEvent } from "@/stories/fixtures/managed-event";
import { mocked } from "storybook/test";

const seriesArgs = {
	params: Promise.resolve({
		eventId: "00000000-0000-4000-8000-000000000001",
	}),
	searchParams: Promise.resolve({ scope: "series" }),
};

const meta = preview.meta({
	component: EditEventPage,
	title: "Pages/Events/Edit",
	parameters: {
		controls: { disable: true },
		layout: "fullscreen",
	},
	args: seriesArgs,
});

export const WholeSeries = meta.story({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
		mocked(getManagedEventForEdit).mockResolvedValue(createManagedEvent());
	},
});

export const OneOccurrence = WholeSeries.extend({
	args: {
		searchParams: Promise.resolve({
			occurrenceDate: "2026-10-22",
			scope: "occurrence",
		}),
	},
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
		mocked(getManagedEventForEdit).mockResolvedValue(
			createManagedEvent({
				occurrenceOverride: {
					description:
						"A special hands-on edition with extra time for guided practice.",
					endsAt: new Date("2026-10-23T04:00:00.000Z"),
					eventUrl: "https://example.com/typescript-workshop",
					locationAddress: "123 J Street, Sacramento, CA 95814",
					locationName: "The Urban Hive",
					mode: "in_person",
					occurrenceDate: "2026-10-22",
					startsAt: new Date("2026-10-23T01:00:00.000Z"),
					timezone: "America/Los_Angeles",
					title: "TypeScript Hands-on Night",
				},
			}),
		);
	},
});

export const ChangesPending = WholeSeries.extend({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
		mocked(getManagedEventForEdit).mockResolvedValue(
			createManagedEvent({
				changeRequests: [
					{
						createdAt: new Date("2026-08-30T18:00:00.000Z"),
						moderationNote: null,
						occurrenceDate: null,
						scope: "series",
						status: "pending",
					},
				],
			}),
		);
	},
});

export const ReviewerRequestedChanges = WholeSeries.extend({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
		mocked(getManagedEventForEdit).mockResolvedValue(
			createManagedEvent({
				changeRequests: [
					{
						createdAt: new Date("2026-08-29T18:00:00.000Z"),
						moderationNote:
							"Please add the accessibility details for the venue before resubmitting.",
						occurrenceDate: null,
						scope: "series",
						status: "rejected",
					},
				],
			}),
		);
	},
});

export const CanceledEvent = WholeSeries.extend({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
		mocked(getManagedEventForEdit).mockResolvedValue(
			createManagedEvent({
				canceledAt: new Date("2026-08-28T18:00:00.000Z"),
			}),
		);
	},
});

export const SharedWithCurrentUser = WholeSeries.extend({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
		mocked(getManagedEventForEdit).mockResolvedValue(
			createManagedEvent({
				collaborators: [],
				isOwner: false,
				submittedBy: "another-user",
			}),
		);
	},
});

export const Loading = WholeSeries.extend({
	beforeEach: () => {
		mocked(requireSession).mockImplementation(() => new Promise(() => {}));
		mocked(getManagedEventForEdit).mockImplementation(
			() => new Promise(() => {}),
		);
	},
});
