import type { Metadata } from "next";
import { getPendingEvents } from "@/lib/events/queries";
import { requireAdminSession } from "@/lib/session";
import style from "./admin-events.module.css";
import { ModerationForm } from "./moderation-form";

export const metadata: Metadata = {
	title: "Event moderation",
	description: "Review event submissions for the SacTech community calendar.",
};

const modeLabels = {
	hybrid: "Hybrid",
	in_person: "In person",
	online: "Online",
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

const cancellationDateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "long",
	timeZone: "UTC",
});

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
	await requireAdminSession();
	const pendingEvents = await getPendingEvents();

	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="page-title" className={style.hero}>
				<div className={style.heroInner}>
					<p className={style.eyebrow}>Admin workspace</p>
					<h1 id="page-title">Review community events.</h1>
					<p>
						Check the details, follow submitted links when needed, and decide
						what is ready for the public SacTech calendar.
					</p>
				</div>
			</section>

			<section aria-labelledby="queue-title" className={style.queue}>
				<header className={style.queueHeader}>
					<div>
						<p className={style.queueEyebrow}>Review queue</p>
						<h2 id="queue-title">Pending submissions</h2>
					</div>
					<p className={style.queueCount}>
						<strong>{pendingEvents.length}</strong>{" "}
						{pendingEvents.length === 1 ? "event" : "events"} waiting
					</p>
				</header>

				{pendingEvents.length === 0 ? (
					<div className={style.emptyState}>
						<span aria-hidden="true" className={style.emptyMark}>
							✓
						</span>
						<div>
							<h3>The queue is clear.</h3>
							<p>New community submissions will appear here for review.</p>
						</div>
					</div>
				) : (
					<ul className={style.eventList}>
						{pendingEvents.map((event) => {
							const titleId = `event-${event.id}-title`;
							const recurrenceSummary = formatRecurrenceSummary(event);
							const canceledOccurrences = [
								...event.canceledOccurrences,
							].sort();

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
													<span>{event.submitterName ?? "Account unavailable"}</span>
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
													<dt>Canceled occurrences</dt>
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
														(event.mode === "online" ? "Online" : "Not provided")}
												</dd>
											</div>
											<div>
												<dt>Address</dt>
												<dd>{event.locationAddress ?? "Not provided"}</dd>
											</div>
										</dl>

										<div className={style.description}>
											<h4>Description</h4>
											<p>{event.description}</p>
										</div>

										{event.eventUrl && (
											<a
												aria-label={`Open submitted event link for ${event.title}`}
												className={style.eventLink}
												href={event.eventUrl}
												rel="noopener noreferrer"
												target="_blank"
											>
												Open submitted event link{" "}
												<span aria-hidden="true">↗</span>
											</a>
										)}

										<ModerationForm eventId={event.id} eventTitle={event.title} />
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
