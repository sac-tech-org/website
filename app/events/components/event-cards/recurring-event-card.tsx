import {
	getNextOccurrence,
	getOccurrenceEnd,
} from "@/lib/events/recurrence";
import { formatDateInTimeZone } from "../../date-utils";
import { EventChip } from "../event-chip/event-chip";
import type { RecurringEventsCardProps } from "./types";
import style from "./recurring-event-card.module.css";

export function RecurringEventsCard({
	event,
	referenceDate,
}: RecurringEventsCardProps) {
	const seed = [...event.blocks].sort(
		(left, right) => left.starts_at.valueOf() - right.starts_at.valueOf(),
	)[0];
	const nextStart =
		event.recurrence_rule && seed
			? getNextOccurrence(
					seed.starts_at,
					event.recurrence_rule,
					referenceDate,
				)
			: null;
	const featuredBlock =
		seed && nextStart
			? {
					...seed,
					ends_at: getOccurrenceEnd(
						seed.starts_at,
						seed.ends_at,
						nextStart,
					),
					starts_at: nextStart,
				}
			: null;
	const primaryLocationUrl =
		event.location_url && event.location_description
			? event.location_url
			: null;

	return (
		<li className={style.card}>
			<div className={style.cardTopline}>
				<span aria-hidden="true" className={style.accentMark} />
				<span>Recurring</span>
			</div>
			<h3 className={style.title}>{event.title}</h3>

			{featuredBlock ? (
				<p className={style.eventDate}>
					<span aria-hidden="true">◷</span>
					<time dateTime={featuredBlock.starts_at.toISOString()}>
						{formatDateInTimeZone(
							featuredBlock.starts_at,
							featuredBlock.timezone,
							{ day: "numeric", month: "long" },
						)}{" "}
						·{" "}
						{formatDateInTimeZone(
							featuredBlock.starts_at,
							featuredBlock.timezone,
							{ hour: "numeric", minute: "2-digit" },
						)}
					</time>
					<span className={style.dateStatus}>Next occurrence</span>
				</p>
			) : (
				<p className={style.eventDate}>No upcoming dates are scheduled.</p>
			)}

			<ul aria-label="Event type" className={style.chips}>
				{event.in_person && (
					<li>
						<EventChip size="compact" variant="in-person" />
					</li>
				)}
				{event.is_online && (
					<li>
						<EventChip size="compact" variant="online" />
					</li>
				)}
			</ul>

			<p className={style.description}>{event.description}</p>

			{featuredBlock?.location_description && (
				<div className={style.topicCard}>
					<div>
						<span>Next occurrence</span>
						<strong>{featuredBlock.location_description}</strong>
					</div>
					{featuredBlock.location_url &&
						featuredBlock.location_url !== primaryLocationUrl && (
						<a
							aria-label={`View details for ${event.title}`}
							href={featuredBlock.location_url}
						>
							View details
						</a>
					)}
				</div>
			)}

			{primaryLocationUrl && event.location_description && (
				<a
					aria-label={`${event.location_description}: ${event.title}`}
					className={style.primaryLink}
					href={primaryLocationUrl}
				>
					{event.location_description}
					<span aria-hidden="true">→</span>
				</a>
			)}
		</li>
	);
}
