import preview from "../../../../../.storybook/preview";

import { expect } from "storybook/test";

import { NonRecurringEventsCard } from "@/app/events/components/event-cards/non-recurring-event-card";
import {
	createEventBlock,
	createLongEventDescription,
	createSpecialEvent,
} from "@/stories/fixtures/events";

const meta = preview.meta({
	title: "Events/Components/Event Cards/Non-recurring",
	component: NonRecurringEventsCard,
	parameters: {
		layout: "padded",
	},
	args: {
		event: createSpecialEvent(),
	},
	argTypes: {
		event: { control: false },
	},
	render: (args) => (
		<ul style={{ listStyle: "none", margin: 0, maxWidth: "36rem", padding: 0 }}>
			<NonRecurringEventsCard {...args} />
		</ul>
	),
});

export const InPerson = meta.story({});

export const Online = InPerson.extend({
	args: {
		event: createSpecialEvent({
			blocks: [
				createEventBlock({
					in_person: false,
					is_online: true,
					location_address: undefined,
					location_description: "Online",
					location_url: "https://events.example.com/online-design-lab",
					slug: "online-design-lab-occurrence",
					title: "Online Design Lab",
				}),
			],
			in_person: false,
			is_online: true,
			location_address: undefined,
			location_description: "Online",
			location_url: "https://events.example.com/online-design-lab",
			slug: "online-design-lab",
			title: "Online Design Lab",
		}),
	},
});

export const HybridMultiDay = InPerson.extend({
	args: {
		event: createSpecialEvent({
			blocks: [
				createEventBlock({
					ends_at: new Date("2026-10-05T23:00:00.000Z"),
					in_person: true,
					is_online: true,
					location_description: "Sacramento Convention Center + livestream",
					location_url: "https://events.example.com/civic-tech-weekend",
					slug: "civic-tech-weekend-occurrence",
					starts_at: new Date("2026-10-03T16:00:00.000Z"),
					title: "Civic Tech Weekend",
				}),
			],
			in_person: true,
			is_online: true,
			location_description: "Sacramento Convention Center + livestream",
			location_url: "https://events.example.com/civic-tech-weekend",
			slug: "civic-tech-weekend",
			title: "Civic Tech Weekend",
		}),
	},
});

export const DatesComingSoon = InPerson.extend({
	args: {
		event: createSpecialEvent({
			blocks: [],
			location_url: undefined,
			slug: "future-community-showcase",
			title: "Future Community Showcase",
		}),
	},
});

const expandedDescriptionTail = "The final workshop details are now visible.";

export const ExpandedDescription = InPerson.extend({
	args: {
		event: createSpecialEvent({
			description: createLongEventDescription(expandedDescriptionTail),
		}),
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Show more details for Sacramento Design Summit",
			}),
		);

		await expect(
			canvas.getByText(expandedDescriptionTail, { exact: false }),
		).toBeVisible();
	},
});
