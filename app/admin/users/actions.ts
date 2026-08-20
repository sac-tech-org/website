"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AUTH_ROLE_NAMES } from "@/lib/auth-permissions";
import {
	getCurrentSession,
	sessionCanManageUsers,
	sessionIsAdmin,
} from "@/lib/session";
import type { UserManagementActionState } from "./state";

const userIdSchema = z.string().trim().min(1).max(255);
const roleSchema = z.enum(AUTH_ROLE_NAMES);
const roleUpdateSchema = z.object({
	roles: z.array(roleSchema).min(1),
	userId: userIdSchema,
});
const banUpdateSchema = z.object({
	action: z.enum(["ban", "unban"]),
	userId: userIdSchema,
});

const forbiddenState = {
	status: "error",
	message: "You do not have permission to manage users.",
} satisfies UserManagementActionState;

async function getAdminActor() {
	const session = await getCurrentSession();

	if (!session || !sessionIsAdmin(session) || !sessionCanManageUsers(session)) {
		return null;
	}

	return session;
}

function isSelfTarget(actorId: string, targetUserId: string) {
	return actorId === targetUserId;
}

export async function updateUserRoles(
	userId: string,
	_previousState: UserManagementActionState,
	formData: FormData,
): Promise<UserManagementActionState> {
	const actor = await getAdminActor();

	if (!actor) {
		return forbiddenState;
	}

	const parsed = roleUpdateSchema.safeParse({
		roles: formData.getAll("roles"),
		userId,
	});

	if (!parsed.success) {
		return {
			status: "error",
			message: "Choose at least one valid role.",
		};
	}

	if (isSelfTarget(actor.user.id, parsed.data.userId)) {
		return {
			status: "error",
			message: "You cannot change your own roles.",
		};
	}

	const roles = [...new Set(parsed.data.roles)];

	try {
		await auth.api.setRole({
			body: {
				role: roles,
				userId: parsed.data.userId,
			},
			headers: await headers(),
		});
	} catch {
		return {
			status: "error",
			message: "The roles could not be updated. Try again.",
		};
	}

	revalidatePath("/admin/users");

	return {
		status: "success",
		message: "Roles updated.",
	};
}

export async function updateUserBan(
	userId: string,
	action: string,
	_previousState: UserManagementActionState,
	_formData: FormData,
): Promise<UserManagementActionState> {
	void _previousState;
	void _formData;

	const actor = await getAdminActor();

	if (!actor) {
		return forbiddenState;
	}

	const parsed = banUpdateSchema.safeParse({ action, userId });

	if (!parsed.success) {
		return {
			status: "error",
			message: "That account action is not valid.",
		};
	}

	if (isSelfTarget(actor.user.id, parsed.data.userId)) {
		return {
			status: "error",
			message: "You cannot ban or unban your own account.",
		};
	}

	try {
		if (parsed.data.action === "ban") {
			await auth.api.banUser({
				body: {
					banReason: "Banned by a SacTech administrator.",
					userId: parsed.data.userId,
				},
				headers: await headers(),
			});
		} else {
			await auth.api.unbanUser({
				body: { userId: parsed.data.userId },
				headers: await headers(),
			});
		}
	} catch {
		return {
			status: "error",
			message: `The account could not be ${parsed.data.action === "ban" ? "banned" : "unbanned"}. Try again.`,
		};
	}

	revalidatePath("/admin/users");

	return {
		status: "success",
		message:
			parsed.data.action === "ban" ? "Account banned." : "Account unbanned.",
	};
}
