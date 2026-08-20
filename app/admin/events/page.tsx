import type { Metadata } from "next";
import type { RecurrenceRule } from "@/app/events/types";
import { EventDescriptionMarkdown } from "@/components/event-description-markdown";
import { formatRecurrenceSummary } from "@/lib/events/format-recurrence-summary";
import { getPendingEventEdits, getPendingEvents } from "@/lib/events/queries";
import {
	getOccurrenceEnd,
	getOccurrencesInRange,
} from "@/lib/events/recurrence";
import { requireEventReviewerSession } from "@/lib/session";
import style from "./admin-events.module.css";
import { ModerationForm } from "./moderation-form";

export const metadata: Metadata = {
	title: "Review events",
	description: "Review event submissions for the SacTech community calendar.",
};

const modeLabels = {
	hybrid: "Hybrid",
	in_person: "In person",
	online: "Online",
} as const;

const cancellationDateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "long",
	timeZone: "UTC",
});

function formatDateTime(date: Date, timeZone: string) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "long",
		timeZone,
		timeZoneName: "short",
		weekday: "long",
		year: "numeric",
	}).format(date);
}

function formatCancellationDate(dateKey: string) {
	return cancellationDateFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}

export default async function AdminEventsPage() {
	await requireEventReviewerSession();
	const [pendingEvents, pendingEdits] = await Promise.all([
		getPendingEvents(),
		getPendingEventEdits(),
	]);

	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="page-title" className={style.hero}>
				<div className={style.heroInner}>
					<p className={style.eyebrow}>SacTech review team</p>
					<h1 id="page-title">Review submitted events.</h1>
					<p>
						Review each submission and decide whether it&apos;s ready for the
						public SacTech calendar. Open the event link if you need more
						context.
					</p>
				</div>
			</section>

			<section aria-labelledby="queue-title" className={style.queue}>
				<header className={style.queueHeader}>
					<div>
						<h2 id="queue-title">Pending submissions</h2>
					</div>
					<p className={style.queueCount}>
						<strong>{pendingEvents.length}</strong>{" "}
						{pendingEvents.length === 1 ? "event" : "events"} waiting
					</p>
				</header>

				{pendingEvents.length === 0 ? (
					<div className={style.emptyState}>
						<div>
							<h3>Nothing to review right now.</h3>
							<p>New community event submissions will show up here.</p>
						</div>
					</div>
				) : (
					<ul className={style.eventList}>
						{pendingEvents.map((event) => {
							const titleId = `event-${event.id}-title`;
							const recurrenceSummary = formatRecurrenceSummary(event);
							const canceledOccurrences = [...event.canceledOccurrences].sort();

							return (
								<li key={event.id}>
									<article
										aria-labelledby={titleId}
										className={style.eventCard}
									>
										<header className={style.cardHeader}>
											<div>
												<p className={style.submittedAt}>
													Submitted{" "}
													<time dateTime={event.createdAt.toISOString()}>
														{formatDateTime(event.createdAt, event.timezone)}
													</time>
												</p>
												<h3 id={titleId}>{event.title}</h3>
											</div>
											<span className={style.pendingBadge}>Pending</span>
										</header>

										<dl className={style.details}>
											<div>
												<dt>Submitted by</dt>
												<dd className={style.submitter}>
													<span>
														{event.submitterName ?? "Account unavailable"}
													</span>
													{event.submitterEmail && (
														<a href={`mailto:${event.submitterEmail}`}>
															{event.submitterEmail}
														</a>
													)}
												</dd>
											</div>
											<div>
												<dt>Attendance</dt>
												<dd>{modeLabels[event.mode]}</dd>
											</div>
											<div>
												<dt>Starts</dt>
												<dd>
													<time dateTime={event.startsAt.toISOString()}>
														{formatDateTime(event.startsAt, event.timezone)}
													</time>
												</dd>
											</div>
											<div>
												<dt>Ends</dt>
												<dd>
													<time dateTime={event.endsAt.toISOString()}>
														{formatDateTime(event.endsAt, event.timezone)}
													</time>
												</dd>
											</div>
											<div className={style.recurrenceDetail}>
												<dt>Recurrence</dt>
												<dd>{recurrenceSummary}</dd>
											</div>
											{canceledOccurrences.length > 0 && (
												<div className={style.cancellationDetail}>
													<dt>Canceled dates</dt>
													<dd>
														<ul
															aria-label={`Canceled dates for ${event.title}`}
														>
															{canceledOccurrences.map((date) => (
																<li key={date}>
																	<time dateTime={date}>
																		{formatCancellationDate(date)}
																	</time>
																</li>
															))}
														</ul>
													</dd>
												</div>
											)}
											<div>
												<dt>Venue</dt>
												<dd>
													{event.locationName ??
														(event.mode === "online"
															? "Online"
															: "Not provided")}
												</dd>
											</div>
											<div>
												<dt>Address</dt>
												<dd>{event.locationAddress ?? "Not provided"}</dd>
											</div>
										</dl>

										<div className={style.description}>
											<h4>Description</h4>
											<EventDescriptionMarkdown
												className={style.descriptionContent}
												markdown={event.description}
											/>
										</div>

										{event.eventUrl && (
											<a
												aria-label={`Open event link for ${event.title}`}
												className={style.eventLink}
												href={event.eventUrl}
												rel="noopener noreferrer"
												target="_blank"
											>
												Open event link <span aria-hidden="true">↗</span>
											</a>
										)}

										<ModerationForm
											eventId={event.id}
											eventTitle={event.title}
										/>
									</article>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<section aria-labelledby="changes-title" className={style.queue}>
				<header className={style.queueHeader}>
					<div>
						<p className={style.queueEyebrow}>Published event updates</p>
						<h2 id="changes-title">Pending changes</h2>
					</div>
					<p className={style.queueCount}>
						<strong>{pendingEdits.length}</strong>{" "}
						{pendingEdits.length === 1 ? "change" : "changes"} waiting
					</p>
				</header>

				{pendingEdits.length === 0 ? (
					<div className={style.emptyState}>
						<div>
							<h3>No event changes are waiting.</h3>
							<p>Edits to approved events will show up here.</p>
						</div>
					</div>
				) : (
					<ul className={style.eventList}>
						{pendingEdits.map((edit) => {
							const titleId = `edit-${edit.id}-title`;
							const currentRule: RecurrenceRule | null =
								edit.currentRecurrenceFrequency &&
								edit.currentRecurrenceInterval &&
								edit.currentRecurrenceEndType
									? {
											endDate: edit.currentRecurrenceEndDate,
											endType: edit.currentRecurrenceEndType,
											excludedDates: [],
											frequency: edit.currentRecurrenceFrequency,
											interval: edit.currentRecurrenceInterval,
											monthlyPattern: edit.currentRecurrenceMonthlyPattern,
											occurrenceCount: edit.currentRecurrenceCount,
											weekdays: edit.currentRecurrenceWeekdays,
										}
									: null;
							let currentStartsAt = edit.currentStartsAt;
							let currentEndsAt = edit.currentEndsAt;

							if (
								edit.scope === "occurrence" &&
								edit.occurrenceDate &&
								currentRule &&
								!edit.hasCurrentOccurrenceOverride
							) {
								const [scheduledStart] = getOccurrencesInRange(
									edit.seriesStartsAt,
									currentRule,
									edit.occurrenceDate,
									edit.occurrenceDate,
								);

								if (scheduledStart) {
									currentStartsAt = scheduledStart;
									currentEndsAt = getOccurrenceEnd(
										edit.seriesStartsAt,
										edit.seriesEndsAt,
										scheduledStart,
									);
								}
							}
							const currentRecurrence = formatRecurrenceSummary({
								recurrenceCount: edit.currentRecurrenceCount,
								recurrenceEndDate: edit.currentRecurrenceEndDate,
								recurrenceEndType: edit.currentRecurrenceEndType,
								recurrenceFrequency: edit.currentRecurrenceFrequency,
								recurrenceInterval: edit.currentRecurrenceInterval,
								recurrenceMonthlyPattern: edit.currentRecurrenceMonthlyPattern,
								recurrenceWeekdays: edit.currentRecurrenceWeekdays,
								startsAt: currentStartsAt,
							});
							const proposedRecurrence = formatRecurrenceSummary(edit);
							const scopeLabel =
								edit.scope === "series"
									? "Whole series"
									: `One occurrence · ${formatCancellationDate(edit.occurrenceDate!)}`;

							return (
								<li key={edit.id}>
									<article
										aria-labelledby={titleId}
										className={style.eventCard}
									>
										<header className={style.cardHeader}>
											<div>
												<p className={style.submittedAt}>
													Proposed by{" "}
													{edit.proposerName ?? "Account unavailable"}
													{" · "}
													<time dateTime={edit.createdAt.toISOString()}>
														{formatDateTime(edit.createdAt, edit.timezone)}
													</time>
												</p>
												<h3 id={titleId}>{edit.title}</h3>
												{edit.proposerEmail && (
													<a href={`mailto:${edit.proposerEmail}`}>
														{edit.proposerEmail}
													</a>
												)}
											</div>
											<span className={style.pendingBadge}>{scopeLabel}</span>
										</header>

										<div className={style.comparison}>
											<section aria-label="Currently live details">
												<h4>Currently live</h4>
												<dl>
													<div>
														<dt>Title</dt>
														<dd>{edit.currentTitle}</dd>
													</div>
													<div>
														<dt>Starts</dt>
														<dd>
															{formatDateTime(currentStartsAt, edit.timezone)}
														</dd>
													</div>
													<div>
														<dt>Ends</dt>
														<dd>
															{formatDateTime(currentEndsAt, edit.timezone)}
														</dd>
													</div>
													<div>
														<dt>Attendance</dt>
														<dd>{modeLabels[edit.currentMode]}</dd>
													</div>
													<div>
														<dt>Venue</dt>
														<dd>
															{edit.currentLocationName ?? "Not provided"}
														</dd>
													</div>
													{edit.scope === "series" && (
														<div>
															<dt>Recurrence</dt>
															<dd>{currentRecurrence}</dd>
														</div>
													)}
												</dl>
												<EventDescriptionMarkdown
													markdown={edit.currentDescription}
												/>
											</section>

											<section aria-label="Proposed details">
												<h4>Proposed</h4>
												<dl>
													<div>
														<dt>Title</dt>
														<dd>{edit.title}</dd>
													</div>
													<div>
														<dt>Starts</dt>
														<dd>
															{formatDateTime(edit.startsAt, edit.timezone)}
														</dd>
													</div>
													<div>
														<dt>Ends</dt>
														<dd>
															{formatDateTime(edit.endsAt, edit.timezone)}
														</dd>
													</div>
													<div>
														<dt>Attendance</dt>
														<dd>{modeLabels[edit.mode]}</dd>
													</div>
													<div>
														<dt>Venue</dt>
														<dd>{edit.locationName ?? "Not provided"}</dd>
													</div>
													{edit.scope === "series" && (
														<div>
															<dt>Recurrence</dt>
															<dd>{proposedRecurrence}</dd>
														</div>
													)}
												</dl>
												<EventDescriptionMarkdown markdown={edit.description} />
											</section>
										</div>

										{edit.eventUrl && (
											<a
												className={style.eventLink}
												href={edit.eventUrl}
												rel="noopener noreferrer"
												target="_blank"
											>
												Open proposed event link{" "}
												<span aria-hidden="true">↗</span>
											</a>
										)}

										<ModerationForm
											eventId={edit.id}
											eventTitle={edit.title}
											reviewType="edit"
										/>
									</article>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</main>
	);
}
