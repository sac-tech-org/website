import type { Metadata } from "next";
import { EventDescriptionMarkdown } from "@/components/event-description-markdown";
import { formatRecurrenceSummary } from "@/lib/events/format-recurrence-summary";
import { getPendingEvents } from "@/lib/events/queries";
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
	const pendingEvents = await getPendingEvents();

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
		</main>
	);
}
