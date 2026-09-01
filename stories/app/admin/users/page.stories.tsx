import preview from "@/.storybook/preview";
import AdminUsersPage from "@/app/admin/users/page";
import { auth } from "@/lib/auth";
import { requireAdminSession } from "@/lib/session";
import {
	CURRENT_ADMIN_LISTED_USER,
	OTHER_LISTED_USERS,
} from "@/stories/fixtures/admin";
import { createSession } from "@/stories/fixtures/auth";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Admin/Manage Users",
	component: AdminUsersPage,
	parameters: {
		layout: "fullscreen",
	},
});

function mockAdminSession() {
	mocked(requireAdminSession).mockResolvedValue(
		createSession({
			email: CURRENT_ADMIN_LISTED_USER.email,
			id: CURRENT_ADMIN_LISTED_USER.id,
			name: CURRENT_ADMIN_LISTED_USER.name,
			role: "admin",
		}),
	);
}

export const LoadingUserList = meta.story({
	beforeEach: () => {
		mocked(requireAdminSession).mockImplementation(() => new Promise(() => {}));
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "Loading community accounts…",
			}),
		).toBeVisible();
	},
});

export const EmptyUserList = meta.story({
	beforeEach: () => {
		mockAdminSession();
		mocked(auth.api.listUsers).mockResolvedValue({
			total: 1,
			users: [CURRENT_ADMIN_LISTED_USER],
		});
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "No other users yet." }),
		).toBeVisible();
		await expect(
			canvas.queryByRole("heading", { name: "Current Admin" }),
		).not.toBeInTheDocument();
	},
});

export const PopulatedUserList = meta.story({
	beforeEach: () => {
		mockAdminSession();
		mocked(auth.api.listUsers).mockResolvedValue({
			total: OTHER_LISTED_USERS.length + 1,
			users: [CURRENT_ADMIN_LISTED_USER, ...OTHER_LISTED_USERS],
		});
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "Alex Rivera" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Samira Patel" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Taylor Morgan" }),
		).toBeVisible();
		await expect(
			canvas.queryByRole("heading", { name: "Current Admin" }),
		).not.toBeInTheDocument();
	},
});
