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

const weekdays = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

interface RecurrenceSummaryInput {
	startsAt: Date;
	recurrenceFrequency: "day" | "week" | "month" | "year" | null;
	recurrenceInterval: number | null;
	recurrenceWeekdays: number[] | null;
	recurrenceMonthlyPattern: "day_of_month" | "nth_weekday" | null;
	recurrenceEndType: "never" | "on_date" | "after_occurrences" | null;
	recurrenceEndDate: string | null;
	recurrenceCount: number | null;
}

function ordinal(value: number) {
	const remainder = value % 100;

	if (remainder >= 11 && remainder <= 13) {
		return `${value}th`;
	}

	switch (value % 10) {
		case 1:
			return `${value}st`;
		case 2:
			return `${value}nd`;
		case 3:
			return `${value}rd`;
		default:
			return `${value}th`;
	}
}

function formatRecurrenceSummary(rule: RecurrenceSummaryInput) {
	if (!rule.recurrenceFrequency) {
		return "Does not repeat";
	}

	const interval = rule.recurrenceInterval ?? 1;
	const startParts = new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "long",
		timeZone: "America/Los_Angeles",
		weekday: "long",
	}).formatToParts(rule.startsAt);
	const startDay = Number(
		startParts.find((part) => part.type === "day")?.value ?? "1",
	);
	const startMonth =
		startParts.find((part) => part.type === "month")?.value ?? "";
	const startWeekday =
		startParts.find((part) => part.type === "weekday")?.value ?? "";
	const unit = rule.recurrenceFrequency;
	let summary =
		interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

	if (unit === "week" && rule.recurrenceWeekdays?.length) {
		const dayNames = rule.recurrenceWeekdays
			.map((day) => weekdays[day])
			.filter((day): day is (typeof weekdays)[number] => Boolean(day));

		if (dayNames.length) {
			summary += ` on ${new Intl.ListFormat("en-US", {
				style: "long",
				type: "conjunction",
			}).format(dayNames)}`;
		}
	}

	if (unit === "month") {
		summary +=
			rule.recurrenceMonthlyPattern === "nth_weekday"
				? ` on the ${ordinal(Math.ceil(startDay / 7))} ${startWeekday}`
				: ` on day ${startDay}`;
	}

	if (unit === "year") {
		summary += ` on ${startMonth} ${startDay}`;
	}

	if (rule.recurrenceEndType === "on_date" && rule.recurrenceEndDate) {
		const endDate = new Date(`${rule.recurrenceEndDate}T12:00:00Z`);
		summary += ` through ${new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium",
			timeZone: "UTC",
		}).format(endDate)}`;
	} else if (
		rule.recurrenceEndType === "after_occurrences" &&
		rule.recurrenceCount
	) {
		summary += ` for ${rule.recurrenceCount} occurrences`;
	} else {
		summary += " with no set end";
	}

	return summary;
}

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
						{submissions.map((submission) => {
							const recurrenceSummary = formatRecurrenceSummary(submission);

							return (
								<li className={style.submissionCard} key={submission.id}>
									<div className={style.cardHeading}>
										<div>
											<h3>{submission.title}</h3>
											<p className={style.eventDate}>
												{dateFormatter.format(submission.startsAt)}
											</p>
											<p className={style.recurrenceSummary}>
												<span aria-hidden="true">↻</span> {recurrenceSummary}
											</p>
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
							);
						})}
					</ul>
				)}
			</section>
		</main>
	);
}
