import preview from "@/.storybook/preview";
import { CancelEventForm } from "@/app/account/cancel-event-form";
import { cancelEvent } from "@/lib/events/actions";
import { expect, mocked, spyOn } from "storybook/test";

const recurringArgs = {
	defaultOccurrenceDate: "2026-10-22",
	eventId: "storybook-event",
	eventTitle: "Sacramento TypeScript Weekly",
	isRecurring: true,
	maxOccurrenceDate: "2027-02-25",
	minOccurrenceDate: "2026-09-01",
};

const meta = preview.meta({
	component: CancelEventForm,
	parameters: {
		layout: "centered",
	},
	args: recurringArgs,
	decorators: [
		(Story) => (
			<div style={{ maxWidth: "48rem", width: "90vw" }}>
				<Story />
			</div>
		),
	],
});

export const RecurringEvent = meta.story({
	beforeEach: () => {
		mocked(cancelEvent).mockResolvedValue({ message: "", status: "idle" });
	},
});

export const OneTimeEvent = RecurringEvent.extend({
	args: {
		defaultOccurrenceDate: null,
		isRecurring: false,
		maxOccurrenceDate: null,
	},
});

export const NoFutureOccurrences = RecurringEvent.extend({
	args: {
		defaultOccurrenceDate: null,
	},
});

export const OccurrenceCanceled = RecurringEvent.extend({
	beforeEach: () => {
		spyOn(window, "confirm").mockReturnValue(true);
		mocked(cancelEvent).mockResolvedValue({
			message: "Occurrence canceled. The rest of the series is unchanged.",
			status: "success",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Cancel this date" }),
		);
		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"Occurrence canceled",
		);
	},
});

export const CancellationRejected = RecurringEvent.extend({
	beforeEach: () => {
		spyOn(window, "confirm").mockReturnValue(true);
		mocked(cancelEvent).mockResolvedValue({
			message: "That event occurrence is already canceled.",
			status: "error",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Cancel this date" }),
		);
		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"already canceled",
		);
	},
});

export const CancelingSeries = RecurringEvent.extend({
	beforeEach: () => {
		spyOn(window, "confirm").mockReturnValue(true);
		mocked(cancelEvent).mockImplementation(() => new Promise(() => {}));
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Cancel the whole series" }),
		);
		await expect(
			canvas.getByRole("button", { name: "Canceling…" }),
		).toBeDisabled();
	},
});
