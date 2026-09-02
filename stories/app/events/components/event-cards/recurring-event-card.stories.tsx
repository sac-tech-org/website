import preview from "../../../../../.storybook/preview";

import { expect } from "storybook/test";

import { RecurringEventsCard } from "@/app/events/components/event-cards/recurring-event-card";
import {
	createLongEventDescription,
	createRecurringEvent,
	createRecurringEventWithOverride,
	createWeeklyRecurrenceRule,
	EVENT_STORY_REFERENCE_DATE,
} from "@/stories/fixtures/events";

const meta = preview.meta({
	title: "Events/Components/Event Cards/Recurring",
	component: RecurringEventsCard,
	parameters: {
		layout: "padded",
	},
	args: {
		event: createRecurringEvent(),
		referenceDate: EVENT_STORY_REFERENCE_DATE,
	},
	argTypes: {
		event: { control: false },
	},
	render: (args) => (
		<ul style={{ listStyle: "none", margin: 0, maxWidth: "36rem", padding: 0 }}>
			<RecurringEventsCard {...args} />
		</ul>
	),
});

export const WeeklyOnline = meta.story({});

export const OccurrenceOverride = WeeklyOnline.extend({
	args: {
		event: createRecurringEventWithOverride(),
		referenceDate: "2026-09-09",
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", { name: "TypeScript Hands-on Night" }),
		).toBeVisible();
		await expect(canvas.getByText("In person")).toBeVisible();
		await expect(canvas.queryByText("Online")).not.toBeInTheDocument();
		await expect(
			canvas.getByRole("link", {
				name: "View event: TypeScript Hands-on Night",
			}),
		).toHaveAttribute("href", "/events/sacramento-typescript-weekly");
	},
});

export const NoUpcomingDates = WeeklyOnline.extend({
	args: {
		event: createRecurringEvent({
			recurrence_rule: createWeeklyRecurrenceRule({
				excludedDates: ["2026-09-02", "2026-09-09"],
				occurrenceCount: 2,
			}),
		}),
	},
});

const expandedDescriptionTail = "The complete recurring agenda is visible.";

export const ExpandedDescription = WeeklyOnline.extend({
	args: {
		event: createRecurringEvent({
			description: createLongEventDescription(expandedDescriptionTail),
		}),
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Show more details for Sacramento TypeScript Weekly",
			}),
		);

		await expect(
			canvas.getByText(expandedDescriptionTail, { exact: false }),
		).toBeVisible();
	},
});
