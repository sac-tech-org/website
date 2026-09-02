import preview from "@/.storybook/preview";
import { EventDetails } from "@/app/events/[eventId]/page";
import {
	createEventBlock,
	createRecurringEventWithOverride,
	createSpecialEvent,
} from "@/stories/fixtures/events";
import { expect } from "storybook/test";

const eventId = "00000000-0000-4000-8000-000000000001";
const specialEvent = createSpecialEvent({
	description: [
		"A one-day gathering for Sacramento designers and technologists.",
		"",
		"# What to expect",
		"",
		"Meet neighbors, compare notes, and leave with practical ideas to try.",
	].join("\n"),
	slug: eventId,
});

const meta = preview.meta({
	component: EventDetails,
	title: "Pages/Events/Detail",
	parameters: {
		layout: "fullscreen",
	},
	args: {
		event: specialEvent,
	},
	argTypes: {
		event: { control: false },
	},
});

export const SpecialEvent = meta.story({
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", {
				level: 1,
				name: "Sacramento Design Summit",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: "Back to all events" }),
		).toHaveAttribute("href", "/events");
		await expect(
			canvas.getByRole("link", { name: "Visit event page" }),
		).toHaveAttribute("href", "https://events.example.com/design-summit");
	},
});

export const RecurringEvent = SpecialEvent.extend({
	args: {
		event: createRecurringEventWithOverride({ slug: eventId }),
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", {
				level: 1,
				name: "Sacramento TypeScript Weekly",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: "Visit event page" }),
		).toHaveAttribute("href", "https://events.example.com/typescript-weekly");
		await expect(
			canvas.getByRole("link", {
				name: "Visit this occurrence's event page",
			}),
		).toHaveAttribute("href", "https://events.example.com/hands-on-night");
	},
});

export const OnlineEvent = SpecialEvent.extend({
	args: {
		event: createSpecialEvent({
			blocks: [
				createEventBlock({
					in_person: false,
					is_online: true,
					location_address: undefined,
					location_description: "Online",
					location_url: "https://events.example.com/online-design-lab",
					slug: `${eventId}-occurrence`,
					title: "Online Design Lab",
				}),
			],
			in_person: false,
			is_online: true,
			location_address: undefined,
			location_description: "Online",
			location_url: "https://events.example.com/online-design-lab",
			slug: eventId,
			title: "Online Design Lab",
		}),
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", { level: 1, name: "Online Design Lab" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: "Visit event page" }),
		).toHaveAttribute("href", "https://events.example.com/online-design-lab");
	},
});
