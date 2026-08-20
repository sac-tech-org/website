import { describe, expect, it } from "vitest";
import {
	ADMIN_AUTH_ROLES,
	APPROVAL_REMINDER_ROLES,
	authAccessControl,
	authRoles,
	DEFAULT_AUTH_ROLE,
	parseAuthRoles,
	roleHasEventPermission,
	roleHasUserPermission,
} from "@/lib/auth-permissions";

describe("Better Auth role permissions", () => {
	it("uses submitter as the default and recognizes legacy user accounts", () => {
		expect(DEFAULT_AUTH_ROLE).toBe("submitter");
		expect(parseAuthRoles(null)).toEqual(["submitter"]);
		expect(parseAuthRoles("user")).toEqual(["submitter"]);
		expect(parseAuthRoles(" user, approver,approver ")).toEqual([
			"submitter",
			"approver",
		]);
		expect(parseAuthRoles("unknown")).toEqual([]);
	});

	it("limits the Better Auth admin role to role and ban management", () => {
		expect(ADMIN_AUTH_ROLES).toEqual(["admin"]);
		expect(authAccessControl.statements.user).toEqual([
			"list",
			"set-role",
			"ban",
		]);
		expect(authRoles.admin.statements.user).toEqual([
			"list",
			"set-role",
			"ban",
		]);
		expect(authRoles.approver.statements.user).toEqual([]);
		expect(authRoles.submitter.statements.user).toEqual([]);
	});

	it("lets every configured role submit and cancel only its own events", () => {
		for (const role of ["submitter", "approver", "admin"]) {
			expect(roleHasEventPermission(role, "submit")).toBe(true);
			expect(roleHasEventPermission(role, "cancel-own")).toBe(true);
		}
	});

	it("makes admin inherit every approver event permission", () => {
		expect(APPROVAL_REMINDER_ROLES).toEqual(["admin", "approver"]);
		expect(authRoles.admin.statements.event).toEqual(
			authRoles.approver.statements.event,
		);

		for (const role of ["approver", "admin"]) {
			expect(roleHasEventPermission(role, "approve")).toBe(true);
			expect(roleHasEventPermission(role, "reject")).toBe(true);
			expect(roleHasEventPermission(role, "receive-approval-reminders")).toBe(
				true,
			);
		}

		expect(roleHasEventPermission("submitter", "approve")).toBe(false);
		expect(
			roleHasEventPermission("submitter", "receive-approval-reminders"),
		).toBe(false);
	});

	it("reserves role changes and bans for admins", () => {
		for (const permission of ["list", "set-role", "ban"] as const) {
			expect(roleHasUserPermission("admin", permission)).toBe(true);
			expect(roleHasUserPermission("approver", permission)).toBe(false);
			expect(roleHasUserPermission("submitter", permission)).toBe(false);
		}
	});
});
