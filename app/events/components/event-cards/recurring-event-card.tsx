import { useMemo } from "react";
import { formatDateInTimeZone } from "../../date-utils";
import { EventChip } from "../event-chip/event-chip";
import type { RecurringEventsCardProps } from "./types";
import style from "./recurring-event-card.module.css";

export function RecurringEventsCard({ event }: RecurringEventsCardProps) {
	const featuredBlock = useMemo(() => {
		return [...event.blocks].sort(
			(a, b) => a.starts_at.valueOf() - b.starts_at.valueOf(),
		).at(-1);
	}, [event.blocks]);

	return (
		<li className={style.card}>
			<div className={style.cardTopline}>
				<span aria-hidden="true" className={style.accentMark} />
				<span>Recurring</span>
			</div>
			<h3 className={style.title}>{event.title}</h3>

			{featuredBlock && (
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
					<span className={style.dateStatus}>Latest listed</span>
				</p>
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
						<span>Latest listing</span>
						<strong>{featuredBlock.location_description}</strong>
					</div>
					{featuredBlock.location_url && (
						<a href={featuredBlock.location_url}>View details</a>
					)}
				</div>
			)}

			{event.location_url && event.location_description && (
				<a className={style.primaryLink} href={event.location_url}>
					{event.location_description}
					<span aria-hidden="true">→</span>
				</a>
			)}
		</li>
	);
}
