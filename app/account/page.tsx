import type { Metadata } from "next";
import Link from "next/link";
import { getSubmissionsForUser } from "@/lib/events/queries";
import { requireSession, sessionIsAdmin } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";
import style from "./account.module.css";

export const metadata: Metadata = {
	title: "Your account",
	description: "Manage your SacTech community event submissions.",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "America/Los_Angeles",
});

const statusLabels = {
	approved: "Approved",
	pending: "Pending review",
	rejected: "Needs changes",
} as const;

export default async function AccountPage() {
	const session = await requireSession();
	const submissions = await getSubmissionsForUser(session.user.id);
	const isAdmin = sessionIsAdmin(session);

	return (
		<main className={style.page} id="main-content">
			<section className={style.hero}>
				<div>
					<p className={style.eyebrow}>Your SacTech account</p>
					<h1>Welcome, {session.user.name}.</h1>
					<p>
						Submit community events, then follow their review status here.
					</p>
				</div>
				<div className={style.accountActions}>
					<Link className={style.primaryAction} href="/events/submit">
						Submit an event
					</Link>
					{isAdmin && (
						<Link className={style.secondaryAction} href="/admin/events">
							Review events
						</Link>
					)}
					<SignOutButton />
				</div>
			</section>

			<section aria-labelledby="submissions-title" className={style.submissions}>
				<div className={style.sectionHeading}>
					<p className={style.eyebrow}>Your submissions</p>
					<h2 id="submissions-title">Events you have sent us</h2>
				</div>

				{submissions.length === 0 ? (
					<div className={style.emptyState}>
						<h3>No events submitted yet</h3>
						<p>
							When you send an event for review, its status will appear here.
						</p>
						<Link href="/events/submit">Share the first one →</Link>
					</div>
				) : (
					<ul className={style.submissionList} role="list">
						{submissions.map((submission) => (
							<li className={style.submissionCard} key={submission.id}>
								<div className={style.cardHeading}>
									<div>
										<h3>{submission.title}</h3>
										<p>{dateFormatter.format(submission.startsAt)}</p>
									</div>
									<span data-status={submission.status}>
										{statusLabels[submission.status]}
									</span>
								</div>
								{submission.moderationNote && (
									<div className={style.reviewNote}>
										<strong>Admin note</strong>
										<p>{submission.moderationNote}</p>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
