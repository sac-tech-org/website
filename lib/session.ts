import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type AuthSession } from "@/lib/auth";

export async function getCurrentSession() {
	return auth.api.getSession({ headers: await headers() });
}

export function sessionIsAdmin(session: AuthSession | null) {
	return Boolean(
		session?.user.role
			?.split(",")
			.map((role) => role.trim())
			.includes("admin"),
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
