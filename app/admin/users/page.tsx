import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { parseAuthRoles } from "@/lib/auth-permissions";
import { requireAdminSession } from "@/lib/session";
import style from "./admin-users.module.css";
import { type ManagedUser, UserManagementCard } from "./user-management-card";

export const metadata: Metadata = {
	title: "Manage users",
	description: "Manage SacTech account roles and access.",
};

const PAGE_SIZE = 100;

async function listUsers(): Promise<ManagedUser[]> {
	const requestHeaders = await headers();
	const users: ManagedUser[] = [];
	let offset = 0;
	let total = Number.POSITIVE_INFINITY;

	while (offset < total) {
		const result = await auth.api.listUsers({
			headers: requestHeaders,
			query: {
				limit: PAGE_SIZE,
				offset,
				sortBy: "name",
				sortDirection: "asc",
			},
		});

		total = result.total;
		users.push(
			...result.users.map((user) => ({
				banned: Boolean(user.banned),
				email: user.email,
				id: user.id,
				name: user.name,
				roles: parseAuthRoles(user.role),
			})),
		);

		if (result.users.length === 0) {
			break;
		}

		offset += result.users.length;
	}

	return users;
}

export default async function AdminUsersPage() {
	const session = await requireAdminSession();
	const users = (await listUsers()).filter(
		(user) => user.id !== session.user.id,
	);

	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="page-title" className={style.hero}>
				<div className={style.heroInner}>
					<p className={style.eyebrow}>SacTech administration</p>
					<h1 id="page-title">Manage community access.</h1>
					<p>
						Assign account roles and suspend access when needed. Your own
						account is intentionally excluded.
					</p>
				</div>
			</section>

			<section aria-labelledby="users-title" className={style.users}>
				<header className={style.usersHeader}>
					<div>
						<p className={style.eyebrow}>Permissions</p>
						<h2 id="users-title">Other users</h2>
					</div>
					<p className={style.userCount}>
						<strong>{users.length}</strong>{" "}
						{users.length === 1 ? "user" : "users"}
					</p>
				</header>

				{users.length === 0 ? (
					<div className={style.emptyState}>
						<h3>No other users yet.</h3>
						<p>New accounts will appear here after they sign up.</p>
					</div>
				) : (
					<ul className={style.userList}>
						{users.map((user) => (
							<li key={user.id}>
								<UserManagementCard user={user} />
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
