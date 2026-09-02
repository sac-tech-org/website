import preview from "@/.storybook/preview";
import { ModerationForm } from "@/app/admin/events/moderation-form";
import { moderateEvent, moderateEventEdit } from "@/lib/events/actions";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	title: "Admin/Events/Moderation Form",
	component: ModerationForm,
	parameters: {
		layout: "centered",
	},
	args: {
		eventId: "9ae8c027-41d6-4890-a431-1d8208b22e40",
		eventTitle: "Sacramento Community Demo Night",
		reviewType: "event",
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: "52rem", width: "90vw" }}>
				<Story />
			</div>
		),
	],
});

function mockIdleActions() {
	mocked(moderateEvent).mockResolvedValue({ message: "", status: "idle" });
	mocked(moderateEventEdit).mockResolvedValue({ message: "", status: "idle" });
}

export const IdleEvent = meta.story({
	args: {
		eventId: "9ae8c027-41d6-4890-a431-1d8208b22e40",
		eventTitle: "Sacramento Community Demo Night",
		reviewType: "event",
	},
	beforeEach: mockIdleActions,
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("button", { name: "Approve and publish" }),
		).toBeEnabled();
		await expect(
			canvas.getByRole("button", { name: "Reject with note" }),
		).toBeEnabled();
	},
});

export const IdleChangeRequest = meta.story({
	args: {
		eventId: "08d3130a-2097-42a1-9319-a53cd149c625",
		eventTitle: "Civic Tech Project Clinic",
		reviewType: "edit",
	},
	beforeEach: mockIdleActions,
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText(
				"Approving replaces the live details with this proposed change.",
			),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Approve changes" }),
		).toBeEnabled();
	},
});

export const PendingDecision = IdleEvent.extend({
	beforeEach: () => {
		mockIdleActions();
		mocked(moderateEvent).mockImplementation(() => new Promise(() => {}));
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Approve and publish" }),
		);

		for (const button of canvas.getAllByRole("button", { name: "Saving…" })) {
			await expect(button).toBeDisabled();
		}
		await expect(
			canvas.getByLabelText("Note to submitter (optional)"),
		).toBeDisabled();
	},
});

export const RejectionError = IdleEvent.extend({
	beforeEach: () => {
		mockIdleActions();
		mocked(moderateEvent).mockResolvedValue({
			message:
				"Explain what the submitter needs to change before resubmitting.",
			status: "error",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByLabelText("Note to submitter (optional)"),
			"Needs work",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Reject with note" }),
		);

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"Explain what the submitter needs to change",
		);
	},
});

export const Approved = IdleEvent.extend({
	beforeEach: () => {
		mockIdleActions();
		mocked(moderateEvent).mockResolvedValue({
			message: "Event approved and published.",
			status: "success",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByLabelText("Note to submitter (optional)"),
			"Ready for the calendar.",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Approve and publish" }),
		);

		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"Event approved and published.",
		);
		await expect(
			canvas.getByLabelText("Note to submitter (optional)"),
		).toHaveValue("");
	},
});
