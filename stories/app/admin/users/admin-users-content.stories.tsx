import preview from "@/.storybook/preview";
import { AdminUsersContent } from "@/app/admin/users/admin-users-content";
import { auth } from "@/lib/auth";
import { requireAdminSession } from "@/lib/session";
import {
	CURRENT_ADMIN_LISTED_USER,
	OTHER_LISTED_USERS,
} from "@/stories/fixtures/admin";
import { createSession } from "@/stories/fixtures/auth";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Admin/User List",
	component: AdminUsersContent,
	parameters: {
		layout: "padded",
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

export const EmptyList = meta.story({
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
	},
});

export const PopulatedList = meta.story({
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
			canvas.getByRole("heading", { name: "Devon Brooks" }),
		).toBeVisible();
		await expect(
			canvas.getByText("Banned", { selector: "span" }),
		).toBeVisible();
	},
});
