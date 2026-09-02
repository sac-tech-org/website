import preview from "@/.storybook/preview";
import { CollaboratorInviteForm } from "@/app/events/[eventId]/edit/collaborator-invite-form";
import { inviteEventCollaborator } from "@/lib/events/actions";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Events/Collaborator Invite Form",
	component: CollaboratorInviteForm,
	parameters: {
		layout: "centered",
	},
	args: {
		eventId: "storybook-event",
	},
	decorators: [
		(Story) => (
			<div style={{ minWidth: "min(36rem, 90vw)" }}>
				<Story />
			</div>
		),
	],
});

export const Idle = meta.story({
	beforeEach: () => {
		mocked(inviteEventCollaborator).mockResolvedValue({
			message: "",
			status: "idle",
		});
	},
});

export const InvitationSent = Idle.extend({
	beforeEach: () => {
		mocked(inviteEventCollaborator).mockResolvedValue({
			message: "Editor invitation sent to teammate@example.com.",
			status: "success",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Account email" }),
			"teammate@example.com",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Invite editor" }),
		);
		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"invitation sent",
		);
	},
});

export const AccountNotFound = Idle.extend({
	beforeEach: () => {
		mocked(inviteEventCollaborator).mockResolvedValue({
			message: "No SacTech account uses that email address.",
			status: "error",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Account email" }),
			"missing@example.com",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Invite editor" }),
		);
		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"No SacTech account",
		);
	},
});

export const Inviting = Idle.extend({
	beforeEach: () => {
		mocked(inviteEventCollaborator).mockImplementation(
			() => new Promise(() => {}),
		);
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Account email" }),
			"teammate@example.com",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Invite editor" }),
		);
		await expect(
			canvas.getByRole("button", { name: "Inviting…" }),
		).toBeDisabled();
	},
});
