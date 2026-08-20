import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserManagementActionState } from "./state";

const mocks = vi.hoisted(() => ({
	banUser: vi.fn(),
	getCurrentSession: vi.fn(),
	headers: vi.fn(),
	revalidatePath: vi.fn(),
	sessionCanManageUsers: vi.fn(),
	sessionIsAdmin: vi.fn(),
	setRole: vi.fn(),
	unbanUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: {
		api: {
			banUser: mocks.banUser,
			setRole: mocks.setRole,
			unbanUser: mocks.unbanUser,
		},
	},
}));

vi.mock("@/lib/session", () => ({
	getCurrentSession: mocks.getCurrentSession,
	sessionCanManageUsers: mocks.sessionCanManageUsers,
	sessionIsAdmin: mocks.sessionIsAdmin,
}));

vi.mock("next/cache", () => ({
	revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/headers", () => ({
	headers: mocks.headers,
}));

import { updateUserBan, updateUserRoles } from "./actions";

const actorSession = { user: { id: "admin-user", role: "admin" } };
const idleState = {
	status: "idle",
	message: "",
} satisfies UserManagementActionState;
const requestHeaders = new Headers({ cookie: "session=test" });

function roleForm(...roles: string[]) {
	const formData = new FormData();

	for (const role of roles) {
		formData.append("roles", role);
	}

	return formData;
}

describe("admin user Server Actions", () => {
	beforeEach(() => {
		mocks.getCurrentSession.mockResolvedValue(actorSession);
		mocks.sessionIsAdmin.mockReturnValue(true);
		mocks.sessionCanManageUsers.mockReturnValue(true);
		mocks.headers.mockResolvedValue(requestHeaders);
		mocks.setRole.mockResolvedValue({});
		mocks.banUser.mockResolvedValue({});
		mocks.unbanUser.mockResolvedValue({});
	});

	it("denies non-admin role and ban requests before calling Better Auth", async () => {
		mocks.sessionIsAdmin.mockReturnValue(false);

		const roleResult = await updateUserRoles(
			"other-user",
			idleState,
			roleForm("submitter"),
		);
		const banResult = await updateUserBan(
			"other-user",
			"ban",
			idleState,
			new FormData(),
		);

		expect(roleResult).toEqual({
			status: "error",
			message: "You do not have permission to manage users.",
		});
		expect(banResult).toEqual(roleResult);
		expect(mocks.setRole).not.toHaveBeenCalled();
		expect(mocks.banUser).not.toHaveBeenCalled();
		expect(mocks.unbanUser).not.toHaveBeenCalled();
		expect(mocks.headers).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("rejects every attempt to target the actor's own account", async () => {
		const roleResult = await updateUserRoles(
			actorSession.user.id,
			idleState,
			roleForm("admin", "approver"),
		);
		const banResult = await updateUserBan(
			actorSession.user.id,
			"ban",
			idleState,
			new FormData(),
		);
		const unbanResult = await updateUserBan(
			actorSession.user.id,
			"unban",
			idleState,
			new FormData(),
		);

		expect(roleResult.message).toBe("You cannot change your own roles.");
		expect(banResult.message).toBe("You cannot ban or unban your own account.");
		expect(unbanResult).toEqual(banResult);
		expect(mocks.setRole).not.toHaveBeenCalled();
		expect(mocks.banUser).not.toHaveBeenCalled();
		expect(mocks.unbanUser).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("validates configured roles and requires at least one", async () => {
		const emptyResult = await updateUserRoles(
			"other-user",
			idleState,
			roleForm(),
		);
		const unknownResult = await updateUserRoles(
			"other-user",
			idleState,
			roleForm("owner"),
		);

		expect(emptyResult.message).toBe("Choose at least one valid role.");
		expect(unknownResult).toEqual(emptyResult);
		expect(mocks.setRole).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("sets validated roles through Better Auth and refreshes the page", async () => {
		const result = await updateUserRoles(
			"other-user",
			idleState,
			roleForm("approver", "submitter", "approver"),
		);

		expect(mocks.setRole).toHaveBeenCalledWith({
			body: {
				role: ["approver", "submitter"],
				userId: "other-user",
			},
			headers: requestHeaders,
		});
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
		expect(result).toEqual({ status: "success", message: "Roles updated." });
	});

	it("bans and unbans through Better Auth", async () => {
		const banResult = await updateUserBan(
			"other-user",
			"ban",
			idleState,
			new FormData(),
		);
		const unbanResult = await updateUserBan(
			"other-user",
			"unban",
			idleState,
			new FormData(),
		);

		expect(mocks.banUser).toHaveBeenCalledWith({
			body: {
				banReason: "Banned by a SacTech administrator.",
				userId: "other-user",
			},
			headers: requestHeaders,
		});
		expect(mocks.unbanUser).toHaveBeenCalledWith({
			body: { userId: "other-user" },
			headers: requestHeaders,
		});
		expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
		expect(banResult).toEqual({
			status: "success",
			message: "Account banned.",
		});
		expect(unbanResult).toEqual({
			status: "success",
			message: "Account unbanned.",
		});
	});

	it("does not refresh when Better Auth rejects a change", async () => {
		mocks.setRole.mockRejectedValue(new Error("Forbidden"));

		const result = await updateUserRoles(
			"other-user",
			idleState,
			roleForm("submitter"),
		);

		expect(result).toEqual({
			status: "error",
			message: "The roles could not be updated. Try again.",
		});
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
