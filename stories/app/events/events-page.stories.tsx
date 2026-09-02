import preview from "../../../.storybook/preview";

import { expect } from "storybook/test";

import EventsPage, { EventsCallouts } from "@/app/events/events-page";
import {
	EVENT_STORY_REFERENCE_DATE,
	MIXED_EVENTS,
} from "@/stories/fixtures/events";

const meta = preview.meta({
	title: "Events/Pages/Events Page",
	component: EventsPage,
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

export const MixedSchedule = meta.story({});

export const EmptySchedule = MixedSchedule.extend({
	args: {
		events: [],
	},
});

export const FilteredToOnline = MixedSchedule.extend({
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("radio", { name: "Online" }));

		await expect(canvas.getByRole("radio", { name: "Online" })).toBeChecked();
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"Showing 1 event for online.",
		);
		await expect(
			canvas.getByRole("heading", {
				name: "Sacramento TypeScript Weekly",
			}),
		).toBeVisible();
		await expect(
			canvas.queryByRole("heading", { name: "Sacramento Design Summit" }),
		).not.toBeInTheDocument();
	},
});

export const CallsToAction = meta.story({
	render: () => <EventsCallouts />,
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("link", { name: "Join the community" }),
		).toHaveAttribute("href", "/#join");
		await expect(
			canvas.getByRole("link", { name: "Submit an event" }),
		).toHaveAttribute("href", "/account");
	},
});
