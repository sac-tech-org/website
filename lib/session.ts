import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type AuthSession } from "@/lib/auth";
import {
	parseAuthRoles,
	roleHasEventPermission,
	roleHasUserPermission,
} from "@/lib/auth-permissions";

export async function getCurrentSession() {
	return auth.api.getSession({ headers: await headers() });
}

export function sessionIsAdmin(session: AuthSession | null) {
	return parseAuthRoles(session?.user.role).includes("admin");
}

export function sessionCanSubmitEvents(session: AuthSession | null) {
	return Boolean(
		session && roleHasEventPermission(session.user.role, "submit"),
	);
}

export function sessionCanCancelOwnEvents(session: AuthSession | null) {
	return Boolean(
		session && roleHasEventPermission(session.user.role, "cancel-own"),
	);
}

export function sessionCanReviewEvents(session: AuthSession | null) {
	return Boolean(
		session &&
		roleHasEventPermission(session.user.role, "approve") &&
		roleHasEventPermission(session.user.role, "reject"),
	);
}

export function sessionCanManageUsers(session: AuthSession | null) {
	return Boolean(
		session &&
		roleHasUserPermission(session.user.role, "set-role") &&
		roleHasUserPermission(session.user.role, "ban"),
	);
}

export async function requireSession() {
	const session = await getCurrentSession();

	if (!session) {
		redirect("/auth");
	}

	return session;
}

export async function requireAdminSession() {
	const session = await requireSession();

	if (!sessionIsAdmin(session)) {
		redirect("/account?notice=admin-required");
	}

	return session;
}

export async function requireEventReviewerSession() {
	const session = await requireSession();

	if (!sessionCanReviewEvents(session)) {
		redirect("/account?notice=reviewer-required");
	}

	return session;
}
