import type { Metadata } from "next";
import Link from "next/link";
import type { RecurrenceRule } from "@/app/events/types";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import {
	formatRecurrenceSummary,
	type RecurrenceSummaryInput,
} from "@/lib/events/format-recurrence-summary";
import { getSubmissionsForUser } from "@/lib/events/queries";
import { getNextFutureOccurrence } from "@/lib/events/recurrence";
import { requireSession, sessionIsAdmin } from "@/lib/session";
import { CancelEventForm } from "./cancel-event-form";
import { SignOutButton } from "./sign-out-button";
import style from "./account.module.css";

export const metadata: Metadata = {
	title: "Your account",
	description: "Manage your SacTech community event submissions.",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: SACRAMENTO_TIME_ZONE,
});

const statusLabels = {
	approved: "Approved",
	canceled: "Canceled",
	pending: "Pending review",
	rejected: "Needs changes",
} as const;

const cancellationDateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "long",
	timeZone: "UTC",
});

const pacificDatePartsFormatter = new Intl.DateTimeFormat("en-US", {
	day: "2-digit",
	month: "2-digit",
	timeZone: SACRAMENTO_TIME_ZONE,
	year: "numeric",
});

function formatPacificDateKey(date: Date) {
	const parts = pacificDatePartsFormatter.formatToParts(date);
	const day = parts.find((part) => part.type === "day")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const year = parts.find((part) => part.type === "year")?.value;

	if (!day || !month || !year) {
		throw new Error("Could not determine the current Sacramento date.");
	}

	return `${year}-${month}-${day}`;
}

function formatCancellationDate(dateKey: string) {
	return cancellationDateFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}

function getRecurrenceRule(
	submission: RecurrenceSummaryInput & { canceledOccurrences: string[] },
): RecurrenceRule | null {
	if (
		!submission.recurrenceFrequency ||
		!submission.recurrenceInterval ||
		!submission.recurrenceEndType
	) {
		return null;
	}

	return {
		endDate: submission.recurrenceEndDate,
		endType: submission.recurrenceEndType,
		excludedDates: submission.canceledOccurrences,
		frequency: submission.recurrenceFrequency,
		interval: submission.recurrenceInterval,
		monthlyPattern: submission.recurrenceMonthlyPattern,
		occurrenceCount: submission.recurrenceCount,
		weekdays: submission.recurrenceWeekdays
			? [...submission.recurrenceWeekdays]
			: null,
	};
}

export default async function AccountPage() {
	const session = await requireSession();
	const submissions = await getSubmissionsForUser(session.user.id);
	const isAdmin = sessionIsAdmin(session);
	const now = new Date();
	const today = formatPacificDateKey(now);

	return (
		<main className={style.page} id="main-content">
			<section className={style.hero}>
				<div>
					<p className={style.eyebrow}>Your SacTech account</p>
					<h1>Welcome, {session.user.name}.</h1>
					<p>Submit community events, then follow their review status here.</p>
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
					<SignOutButton className={style.secondaryAction} />
				</div>
			</section>

			<section
				aria-labelledby="submissions-title"
				className={style.submissions}
			>
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
							const recurrenceRule = getRecurrenceRule(submission);
							const nextOccurrence =
								!submission.canceledAt && recurrenceRule
									? getNextFutureOccurrence(
											submission.startsAt,
											recurrenceRule,
											now,
										)
									: null;
							const defaultOccurrenceDate = nextOccurrence
								? formatPacificDateKey(nextOccurrence)
								: null;
							const displayStatus = submission.canceledAt
								? "canceled"
								: submission.status;
							const canceledOccurrences = [
								...submission.canceledOccurrences,
							].sort();

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
										<span data-status={displayStatus}>
											{statusLabels[displayStatus]}
										</span>
									</div>
									{submission.canceledAt && (
										<p className={style.canceledEventNotice}>
											Canceled on {dateFormatter.format(submission.canceledAt)}.
										</p>
									)}
									{canceledOccurrences.length > 0 && (
										<div className={style.canceledOccurrences}>
											<h4>Canceled occurrences</h4>
											<ul aria-label={`Canceled dates for ${submission.title}`}>
												{canceledOccurrences.map((date) => (
													<li key={date}>
														<time dateTime={date}>
															{formatCancellationDate(date)}
														</time>
													</li>
												))}
											</ul>
										</div>
									)}
									{submission.moderationNote && (
										<div className={style.reviewNote}>
											<strong>Admin note</strong>
											<p>{submission.moderationNote}</p>
										</div>
									)}
									{!submission.canceledAt && (
										<CancelEventForm
											defaultOccurrenceDate={defaultOccurrenceDate}
											eventId={submission.id}
											eventTitle={submission.title}
											isRecurring={Boolean(recurrenceRule)}
											maxOccurrenceDate={
												recurrenceRule?.endType === "on_date"
													? recurrenceRule.endDate
													: null
											}
											minOccurrenceDate={today}
										/>
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
