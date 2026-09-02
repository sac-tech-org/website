import preview from "@/.storybook/preview";
import {
	EventForm,
	type EventFormAction,
	type EventFormValues,
} from "@/app/events/submit/event-form";
import type { EventFormState } from "@/lib/events/state";
import { expect, fn } from "storybook/test";

const idleAction = fn<EventFormAction>(async () => ({
	message: "",
	status: "idle",
}));

const baseValues: EventFormValues = {
	description:
		"A welcoming demo night for Sacramento developers, designers, and makers.",
	endsAt: "2026-10-15T20:30",
	eventUrl: "https://example.com/sacramento-demo-night",
	locationAddress: "828 I Street, Sacramento, CA 95814",
	locationName: "Sacramento Central Library",
	mode: "hybrid",
	recurrenceCount: "8",
	recurrenceEndDate: "2027-02-18",
	recurrenceEndType: "never",
	recurrenceFrequency: "week",
	recurrenceInterval: "1",
	recurrenceMonthlyPattern: "day_of_month",
	recurrenceWeekdays: [4],
	recurring: false,
	startsAt: "2026-10-15T18:00",
	title: "Sacramento Community Demo Night",
};

const weeklyValues: EventFormValues = {
	...baseValues,
	recurrenceEndType: "after_occurrences",
	recurrenceWeekdays: [2, 4],
	recurring: true,
};

const meta = preview.meta({
	title: "Components/Event Form",
	component: EventForm,
	parameters: {
		layout: "padded",
	},
	args: {
		action: idleAction,
		allowRecurrence: true,
		variant: "submit",
	},
	decorators: [
		(Story) => (
			<main style={{ margin: "0 auto", maxWidth: "56rem" }}>
				<Story />
			</main>
		),
	],
});

export const BlankSubmission = meta.story({});

export const OneTimeHybridEvent = BlankSubmission.extend({
	args: {
		initialValues: baseValues,
	},
});

export const WeeklySeries = OneTimeHybridEvent.extend({
	args: {
		initialValues: weeklyValues,
	},
});

export const MonthlySeries = WeeklySeries.extend({
	args: {
		initialValues: {
			...weeklyValues,
			recurrenceEndDate: "2027-10-15",
			recurrenceEndType: "on_date",
			recurrenceFrequency: "month",
			recurrenceInterval: "1",
			recurrenceMonthlyPattern: "nth_weekday",
		},
	},
});

export const YearlySeries = WeeklySeries.extend({
	args: {
		initialValues: {
			...weeklyValues,
			recurrenceEndType: "never",
			recurrenceFrequency: "year",
			recurrenceInterval: "1",
		},
	},
});

export const OccurrenceEdit = OneTimeHybridEvent.extend({
	args: {
		allowRecurrence: false,
		variant: "edit",
	},
});

const validationError: EventFormState = {
	errors: {
		eventUrl: ["Use a complete http:// or https:// link."],
		title: ["Use a more descriptive event title."],
	},
	message: "Review the highlighted fields and try again.",
	status: "error",
};

export const ServerValidationErrors = OneTimeHybridEvent.extend({
	args: {
		action: fn<EventFormAction>(async () => validationError),
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Submit event for review" }),
		);
		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"Review the highlighted fields",
		);
	},
});

export const Submitted = OneTimeHybridEvent.extend({
	args: {
		action: fn<EventFormAction>(async () => ({
			message: "Event submitted for review.",
			status: "success",
		})),
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Submit event for review" }),
		);
		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"Event submitted for review.",
		);
	},
});

export const Submitting = OneTimeHybridEvent.extend({
	args: {
		action: fn<EventFormAction>(() => new Promise(() => {})),
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Submit event for review" }),
		);
		await expect(
			canvas.getByRole("button", { name: "Submitting…" }),
		).toBeDisabled();
	},
});
