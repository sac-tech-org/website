import { createAccessControl } from "better-auth/plugins";

export const AUTH_ROLE_NAMES = ["admin", "approver", "submitter"] as const;

export type AuthRole = (typeof AUTH_ROLE_NAMES)[number];

export const DEFAULT_AUTH_ROLE = "submitter" satisfies AuthRole;
export const ADMIN_AUTH_ROLES = ["admin"] satisfies AuthRole[];

export const authAccessControl = createAccessControl({
	event: [
		"submit",
		"cancel-own",
		"approve",
		"reject",
		"receive-approval-reminders",
	],
	user: ["list", "set-role", "ban"],
} as const);

const submitterEventPermissions = ["submit", "cancel-own"] as const;
const reviewerEventPermissions = [
	...submitterEventPermissions,
	"approve",
	"reject",
] as const;
const approverEventPermissions = [
	...reviewerEventPermissions,
	"receive-approval-reminders",
] as const;
const approverPermissions = {
	event: approverEventPermissions,
	user: [],
} as const;

export const authRoles = {
	admin: authAccessControl.newRole({
		...approverPermissions,
		user: [...approverPermissions.user, "list", "set-role", "ban"],
	}),
	approver: authAccessControl.newRole(approverPermissions),
	submitter: authAccessControl.newRole({
		event: submitterEventPermissions,
		user: [],
	}),
} as const;

export const APPROVAL_REMINDER_ROLES = AUTH_ROLE_NAMES.filter(
	(role) =>
		authRoles[role].authorize({ event: ["receive-approval-reminders"] })
			.success,
);

export type EventPermission =
	(typeof authAccessControl.statements.event)[number];
export type UserPermission = (typeof authAccessControl.statements.user)[number];

const authRoleNameSet = new Set<string>(AUTH_ROLE_NAMES);

/**
 * Better Auth stores multiple roles as a comma-separated string. Treat a
 * missing role and the pre-RBAC `user` role as the default submitter while the
 * data migration rolls through every deploy context.
 */
export function parseAuthRoles(value: string | null | undefined): AuthRole[] {
	if (!value?.trim()) {
		return [DEFAULT_AUTH_ROLE];
	}

	const roles = value
		.split(",")
		.map((role) => role.trim())
		.map((role) => (role === "user" ? DEFAULT_AUTH_ROLE : role))
		.filter((role): role is AuthRole => authRoleNameSet.has(role));

	return [...new Set(roles)];
}

export function roleHasEventPermission(
	role: string | null | undefined,
	permission: EventPermission,
) {
	return parseAuthRoles(role).some(
		(roleName) =>
			authRoles[roleName].authorize({ event: [permission] }).success,
	);
}

export function roleHasUserPermission(
	role: string | null | undefined,
	permission: UserPermission,
) {
	return parseAuthRoles(role).some(
		(roleName) => authRoles[roleName].authorize({ user: [permission] }).success,
	);
}
