import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { initialUserManagementActionState } from "./state";
import { type ManagedUser, UserManagementCard } from "./user-management-card";

const serverActions = vi.hoisted(() => ({
	updateUserBan: vi.fn(),
	updateUserRoles: vi.fn(),
}));

vi.mock("./actions", () => serverActions);

const activeUser = {
	banned: false,
	email: "alex@example.com",
	id: "other-user",
	name: "Alex Rivera",
	roles: ["submitter"],
} satisfies ManagedUser;

function submittedRoleFields() {
	const [userId, previousState, formData] = serverActions.updateUserRoles.mock
		.calls[0] as [string, typeof initialUserManagementActionState, FormData];

	return {
		previousState,
		roles: formData.getAll("roles"),
		userId,
	};
}

describe("UserManagementCard", () => {
	beforeEach(() => {
		serverActions.updateUserRoles.mockResolvedValue({
			status: "success",
			message: "Roles updated.",
		});
		serverActions.updateUserBan.mockResolvedValue({
			status: "success",
			message: "Account banned.",
		});
	});

	it("shows configured role meanings and submits selected roles", async () => {
		const browserUser = userEvent.setup();
		render(<UserManagementCard user={{ ...activeUser }} />);

		expect(screen.getByRole("checkbox", { name: /Admin/ })).not.toBeChecked();
		expect(
			screen.getByRole("checkbox", { name: /Approver/ }),
		).not.toBeChecked();
		expect(screen.getByRole("checkbox", { name: /Submitter/ })).toBeChecked();
		expect(
			screen.getByText("Review events and receive approval reminders."),
		).toBeVisible();
		expect(
			screen.getByText(
				"Review events, receive reminders, and manage other users.",
			),
		).toBeVisible();

		await browserUser.click(screen.getByRole("checkbox", { name: /Approver/ }));
		await browserUser.click(screen.getByRole("button", { name: "Save roles" }));

		await waitFor(() =>
			expect(serverActions.updateUserRoles).toHaveBeenCalledTimes(1),
		);
		expect(submittedRoleFields()).toEqual({
			previousState: initialUserManagementActionState,
			roles: ["approver", "submitter"],
			userId: activeUser.id,
		});
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Roles updated.",
		);
	});

	it("requires confirmation before banning an active user", async () => {
		const browserUser = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
		render(<UserManagementCard user={{ ...activeUser }} />);

		await browserUser.click(
			screen.getByRole("button", { name: "Ban account" }),
		);

		expect(confirm).toHaveBeenCalledWith(
			"Ban Alex Rivera? They will be signed out immediately.",
		);
		expect(serverActions.updateUserBan).not.toHaveBeenCalled();
	});

	it("submits an unban without a destructive confirmation", async () => {
		const browserUser = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm");
		serverActions.updateUserBan.mockResolvedValue({
			status: "success",
			message: "Account unbanned.",
		});
		render(<UserManagementCard user={{ ...activeUser, banned: true }} />);

		await browserUser.click(
			screen.getByRole("button", { name: "Unban account" }),
		);

		await waitFor(() =>
			expect(serverActions.updateUserBan).toHaveBeenCalledTimes(1),
		);
		expect(serverActions.updateUserBan.mock.calls[0]?.slice(0, 3)).toEqual([
			activeUser.id,
			"unban",
			initialUserManagementActionState,
		]);
		expect(confirm).not.toHaveBeenCalled();
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Account unbanned.",
		);
	});
});
