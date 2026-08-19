import { useMemo } from "react";
import { formatDateInTimeZone, formatDateKey } from "../../date-utils";
import { EventChip } from "../event-chip/event-chip";
import type { NonRecurringEventsCardProps } from "./types";
import style from "./non-recurring-event-card.module.css";

export function NonRecurringEventsCard({ event }: NonRecurringEventsCardProps) {
	const { endBlock, startBlock } = useMemo(() => {
		const startSortedBlocks = [...event.blocks].sort(
			(a, b) => a.starts_at.valueOf() - b.starts_at.valueOf(),
		);
		const endSortedBlocks = [...event.blocks].sort(
			(a, b) => b.ends_at.valueOf() - a.ends_at.valueOf(),
		);

		return {
			endBlock: endSortedBlocks[0],
			startBlock: startSortedBlocks[0],
		};
	}, [event.blocks]);

	const dateLabel =
		startBlock && endBlock
			? formatDateKey(startBlock.starts_at, startBlock.timezone) ===
				formatDateKey(endBlock.ends_at, endBlock.timezone)
				? formatDateInTimeZone(startBlock.starts_at, startBlock.timezone, {
						day: "numeric",
						month: "long",
						year: "numeric",
					})
				: `${formatDateInTimeZone(startBlock.starts_at, startBlock.timezone, {
						day: "numeric",
						month: "long",
					})} – ${formatDateInTimeZone(endBlock.ends_at, endBlock.timezone, {
						day: "numeric",
						month: "long",
						year: "numeric",
					})}`
			: "Dates coming soon";

	return (
		<li className={style.card}>
			<div className={style.cardTopline}>
				<span aria-hidden="true" className={style.accentMark} />
				<span>Special event</span>
			</div>
			<h3 className={style.title}>{event.title}</h3>
			<p className={style.eventDate}>
				<span aria-hidden="true">◷</span>
				{startBlock ? (
					<time dateTime={formatDateKey(startBlock.starts_at, startBlock.timezone)}>
						{dateLabel}
					</time>
				) : (
					dateLabel
				)}
			</p>
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
			{event.location_url && (
				<a
					aria-label={`View details for ${event.title}`}
					className={style.primaryLink}
					href={event.location_url}
				>
					{event.location_description || "View event details"}
					<span aria-hidden="true">→</span>
				</a>
			)}
		</li>
	);
}
