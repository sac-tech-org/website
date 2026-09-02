import preview from "../../../../../.storybook/preview";

import { EventChip } from "@/app/events/components/event-chip/event-chip";

const meta = preview.meta({
	title: "Events/Components/Event Chip",
	component: EventChip,
	parameters: {
		layout: "centered",
	},
	args: {
		size: "default",
		variant: "online",
	},
});

export const Online = meta.story({
	args: {
		size: "default",
		variant: "online",
	},
});

export const OnlineCompact = Online.extend({
	args: {
		size: "compact",
	},
});

export const InPerson = Online.extend({
	args: {
		variant: "in-person",
	},
});

export const RecurringDaily = meta.story({
	args: {
		every: "day",
		size: "default",
		variant: "recurring",
	},
});

export const RecurringWeekly = RecurringDaily.extend({
	args: {
		every: "week",
	},
});

export const RecurringMonthly = RecurringDaily.extend({
	args: {
		every: "month",
	},
});

export const RecurringYearly = RecurringDaily.extend({
	args: {
		every: "year",
	},
});
