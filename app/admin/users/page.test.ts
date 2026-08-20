import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	headers: vi.fn(),
	listUsers: vi.fn(),
	requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: { api: { listUsers: mocks.listUsers } },
}));

vi.mock("@/lib/session", () => ({
	requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("next/headers", () => ({
	headers: mocks.headers,
}));

vi.mock("./user-management-card", async () => {
	const { createElement } = await import("react");

	return {
		UserManagementCard: ({ user }: { user: { name: string } }) =>
			createElement("p", null, user.name),
	};
});

import AdminUsersPage from "./page";

describe("AdminUsersPage", () => {
	beforeEach(() => {
		mocks.requireAdminSession.mockResolvedValue({
			user: { id: "current-admin" },
		});
		mocks.headers.mockResolvedValue(new Headers());
		mocks.listUsers.mockResolvedValue({ users: [], total: 0 });
	});

	it("stops before listing users when the admin page guard denies access", async () => {
		mocks.requireAdminSession.mockRejectedValue(new Error("admin-required"));

		await expect(AdminUsersPage()).rejects.toThrow("admin-required");
		expect(mocks.listUsers).not.toHaveBeenCalled();
	});

	it("lists other users but never exposes the actor as a management target", async () => {
		mocks.listUsers.mockResolvedValue({
			total: 2,
			users: [
				{
					banned: false,
					email: "admin@example.com",
					id: "current-admin",
					name: "Current Admin",
					role: "admin",
				},
				{
					banned: false,
					email: "member@example.com",
					id: "other-user",
					name: "Other User",
					role: "submitter",
				},
			],
		});

		const markup = renderToStaticMarkup(await AdminUsersPage());

		expect(markup).toContain("Other User");
		expect(markup).not.toContain("Current Admin");
		expect(markup).toContain("<strong>1</strong> user");
	});
});
