import preview from "@/.storybook/preview";
import { updateUserBan, updateUserRoles } from "@/app/admin/users/actions";
import { UserManagementCard } from "@/app/admin/users/user-management-card";
import { STORY_MANAGED_USERS } from "@/stories/fixtures/admin";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Admin/User Management Card",
	component: UserManagementCard,
	parameters: {
		layout: "centered",
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: "72rem", width: "95vw" }}>
				<Story />
			</div>
		),
	],
});

function mockIdleActions() {
	mocked(updateUserRoles).mockResolvedValue({ message: "", status: "idle" });
	mocked(updateUserBan).mockResolvedValue({ message: "", status: "idle" });
}

export const SubmitterActive = meta.story({
	args: {
		user: STORY_MANAGED_USERS.submitter,
	},
	beforeEach: mockIdleActions,
});

export const ApproverActive = meta.story({
	args: {
		user: STORY_MANAGED_USERS.approver,
	},
	beforeEach: mockIdleActions,
});

export const AdministratorActive = meta.story({
	args: {
		user: STORY_MANAGED_USERS.administrator,
	},
	beforeEach: mockIdleActions,
});

export const BannedSubmitter = meta.story({
	args: {
		user: STORY_MANAGED_USERS.bannedSubmitter,
	},
	beforeEach: mockIdleActions,
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText("Banned", { selector: "span" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Unban account" }),
		).toBeEnabled();
	},
});

export const SavingRoles = meta.story({
	args: {
		user: STORY_MANAGED_USERS.submitter,
	},
	beforeEach: () => {
		mockIdleActions();
		mocked(updateUserRoles).mockImplementation(() => new Promise(() => {}));
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Save roles" }));

		await expect(
			canvas.getByRole("button", { name: "Saving…" }),
		).toBeDisabled();
		await expect(
			canvas.getByRole("button", { name: "Ban account" }),
		).toBeDisabled();
	},
});

export const RoleUpdateError = meta.story({
	args: {
		user: STORY_MANAGED_USERS.submitter,
	},
	beforeEach: () => {
		mockIdleActions();
		mocked(updateUserRoles).mockResolvedValue({
			message: "Choose at least one valid role.",
			status: "error",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("checkbox", { name: /Submitter/ }));
		await userEvent.click(canvas.getByRole("button", { name: "Save roles" }));

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"Choose at least one valid role.",
		);
	},
});

export const RolesUpdated = meta.story({
	args: {
		user: STORY_MANAGED_USERS.submitter,
	},
	beforeEach: () => {
		mockIdleActions();
		mocked(updateUserRoles).mockResolvedValue({
			message: "Roles updated.",
			status: "success",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("checkbox", { name: /Approver/ }));
		await userEvent.click(canvas.getByRole("button", { name: "Save roles" }));

		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"Roles updated.",
		);
	},
});

export const UnbanningAccount = meta.story({
	args: {
		user: STORY_MANAGED_USERS.bannedSubmitter,
	},
	beforeEach: () => {
		mockIdleActions();
		mocked(updateUserBan).mockImplementation(() => new Promise(() => {}));
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Unban account" }),
		);

		await expect(
			canvas.getByRole("button", { name: "Unbanning…" }),
		).toBeDisabled();
		await expect(
			canvas.getByRole("button", { name: "Save roles" }),
		).toBeDisabled();
	},
});

export const UnbanError = meta.story({
	args: {
		user: STORY_MANAGED_USERS.bannedSubmitter,
	},
	beforeEach: () => {
		mockIdleActions();
		mocked(updateUserBan).mockResolvedValue({
			message: "The account could not be unbanned. Try again.",
			status: "error",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Unban account" }),
		);

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"The account could not be unbanned.",
		);
	},
});

export const AccountUnbanned = meta.story({
	args: {
		user: STORY_MANAGED_USERS.bannedSubmitter,
	},
	beforeEach: () => {
		mockIdleActions();
		mocked(updateUserBan).mockResolvedValue({
			message: "Account unbanned.",
			status: "success",
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Unban account" }),
		);

		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"Account unbanned.",
		);
	},
});
