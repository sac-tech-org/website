import preview from "../../.storybook/preview.tsx";

import { expect } from "storybook/test";

import { Calendar } from "@/app/events/components/calendar/calendar.tsx";
import {
	createRecurringEvent,
	createRecurringEventWithOverride,
	createSpecialEvent,
	EVENT_STORY_REFERENCE_DATE,
	MIXED_EVENTS,
} from "@/stories/fixtures/events.ts";

const meta = preview.meta({
	title: "Components/Calendar",
	component: Calendar,
	parameters: {
		layout: "padded",
	},
	args: {
		events: MIXED_EVENTS,
		referenceDate: EVENT_STORY_REFERENCE_DATE,
	},
	argTypes: {
		events: { control: false },
	},
});

export const MixedEvents = meta.story({});

export const Empty = MixedEvents.extend({
	args: {
		events: [],
	},
});

export const SelectedOccurrence = MixedEvents.extend({
	args: {
		events: [createRecurringEventWithOverride()],
	},
	play: async ({ canvas, userEvent }) => {
		const occurrence = canvas.getByRole("button", {
			name: "September 15, 2026, 1 event",
		});

		await userEvent.click(occurrence);

		await expect(occurrence).toHaveAttribute("aria-pressed", "true");
		await expect(
			canvas.getByRole("region", { name: "September 15, 2026" }),
		).toBeVisible();
		await expect(canvas.getByText("TypeScript Hands-on Night")).toBeVisible();
		await expect(
			canvas.getByRole("link", {
				name: "View event: TypeScript Hands-on Night",
			}),
		).toHaveAttribute("href", "/events/sacramento-typescript-weekly");
	},
});

export const NextMonthWindow = meta.story({
	args: {
		events: [createRecurringEvent(), createSpecialEvent()],
	},
	play: async ({ canvas, userEvent }) => {
		await expect(
			canvas.getByRole("table", { name: "September 2026" }),
		).toBeVisible();

		await userEvent.click(
			canvas.getByRole("button", { name: "Show next month" }),
		);

		await expect(
			canvas.queryByRole("table", { name: "September 2026" }),
		).not.toBeInTheDocument();
		await expect(
			canvas.getByRole("table", { name: "December 2026" }),
		).toBeVisible();
	},
});
