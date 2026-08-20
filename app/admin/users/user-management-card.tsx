"use client";

import { useActionState, useId } from "react";
import type { AuthRole } from "@/lib/auth-permissions";
import { updateUserBan, updateUserRoles } from "./actions";
import style from "./admin-users.module.css";
import { initialUserManagementActionState } from "./state";

export interface ManagedUser {
	banned: boolean;
	email: string;
	id: string;
	name: string;
	roles: AuthRole[];
}

interface UserManagementCardProps {
	user: ManagedUser;
}

const roleOptions = [
	{
		description: "Review events, receive reminders, and manage other users.",
		label: "Admin",
		value: "admin",
	},
	{
		description: "Review events and receive approval reminders.",
		label: "Approver",
		value: "approver",
	},
	{
		description: "Submit events and cancel their own events.",
		label: "Submitter",
		value: "submitter",
	},
] as const satisfies ReadonlyArray<{
	description: string;
	label: string;
	value: AuthRole;
}>;

function ActionMessage({
	state,
}: {
	state: typeof initialUserManagementActionState;
}) {
	if (!state.message) {
		return null;
	}

	return (
		<p
			aria-atomic="true"
			className={
				state.status === "success" ? style.successMessage : style.errorMessage
			}
			role={state.status === "success" ? "status" : "alert"}
		>
			{state.message}
		</p>
	);
}

export function UserManagementCard({ user }: UserManagementCardProps) {
	const idPrefix = useId();
	const updateRolesForUser = updateUserRoles.bind(null, user.id);
	const updateBanForUser = updateUserBan.bind(
		null,
		user.id,
		user.banned ? "unban" : "ban",
	);
	const [roleState, roleAction, rolePending] = useActionState(
		updateRolesForUser,
		initialUserManagementActionState,
	);
	const [banState, banAction, banPending] = useActionState(
		updateBanForUser,
		initialUserManagementActionState,
	);

	return (
		<article className={style.userCard}>
			<header className={style.cardHeader}>
				<div>
					<h2>{user.name}</h2>
					<a href={`mailto:${user.email}`}>{user.email}</a>
				</div>
				<span className={style.statusBadge} data-banned={user.banned}>
					{user.banned ? "Banned" : "Active"}
				</span>
			</header>

			<div className={style.managementGrid}>
				<form action={roleAction} className={style.roleForm}>
					<fieldset disabled={rolePending || banPending}>
						<legend>Roles</legend>
						<div className={style.roleOptions}>
							{roleOptions.map((role) => {
								const inputId = `${idPrefix}-${role.value}`;

								return (
									<label htmlFor={inputId} key={role.value}>
										<input
											defaultChecked={user.roles.includes(role.value)}
											id={inputId}
											name="roles"
											type="checkbox"
											value={role.value}
										/>
										<span>
											<strong>{role.label}</strong>
											<small>{role.description}</small>
										</span>
									</label>
								);
							})}
						</div>
					</fieldset>

					<ActionMessage state={roleState} />
					<button
						className={style.saveButton}
						disabled={rolePending || banPending}
						type="submit"
					>
						{rolePending ? "Saving…" : "Save roles"}
					</button>
				</form>

				<div className={style.accountControl}>
					<div>
						<h3>Account access</h3>
						<p>
							{user.banned
								? "Unbanning restores sign-in access."
								: "Banning signs this user out and blocks future sign-ins."}
						</p>
					</div>
					<form
						action={banAction}
						onSubmit={(event) => {
							if (
								!user.banned &&
								!window.confirm(
									`Ban ${user.name}? They will be signed out immediately.`,
								)
							) {
								event.preventDefault();
							}
						}}
					>
						<ActionMessage state={banState} />
						<button
							className={user.banned ? style.unbanButton : style.banButton}
							disabled={banPending || rolePending}
							type="submit"
						>
							{banPending
								? user.banned
									? "Unbanning…"
									: "Banning…"
								: user.banned
									? "Unban account"
									: "Ban account"}
						</button>
					</form>
				</div>
			</div>
		</article>
	);
}
