import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminUsersContent } from "./admin-users-content";
import style from "./admin-users.module.css";

export const metadata: Metadata = {
	title: "Manage users",
	description: "Manage SacTech account roles and access.",
};

function AdminUsersFallback() {
	return (
		<section
			aria-busy="true"
			aria-labelledby="users-title"
			className={style.users}
		>
			<header className={style.usersHeader}>
				<div>
					<p className={style.eyebrow}>Permissions</p>
					<h2 id="users-title">Other users</h2>
				</div>
			</header>
			<div className={style.emptyState} role="status">
				<h3>Loading community accounts…</h3>
				<p>Checking your admin access and the current user list.</p>
			</div>
		</section>
	);
}

export default function AdminUsersPage() {
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
			<Suspense fallback={<AdminUsersFallback />}>
				<AdminUsersContent />
			</Suspense>
		</main>
	);
}
