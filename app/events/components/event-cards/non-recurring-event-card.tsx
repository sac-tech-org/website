import Link from "next/link";
import { useMemo } from "react";
import { CollapsibleEventDescription } from "@/components/collapsible-event-description";
import { formatDateInTimeZone, formatDateKey } from "../../date-utils";
import { EventChip } from "../event-chip/event-chip";
import { EventCardImage } from "./event-card-image";
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
					})} to ${formatDateInTimeZone(endBlock.ends_at, endBlock.timezone, {
						day: "numeric",
						month: "long",
						year: "numeric",
					})}`
			: "Dates coming soon";

	return (
		<li className={style.card}>
			<EventCardImage imageUrl={event.banner_image} />
			<div className={style.cardTopline}>
				<span aria-hidden="true" className={style.accentMark} />
				<span>Special event</span>
			</div>
			<h3 className={style.title}>{event.title}</h3>
			<p className={style.eventDate}>
				<span aria-hidden="true">◷</span>
				{startBlock ? (
					<time
						dateTime={formatDateKey(startBlock.starts_at, startBlock.timezone)}
					>
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
			<CollapsibleEventDescription
				className={style.description}
				eventTitle={event.title}
				markdown={event.description}
			/>
			<Link
				aria-label={`View event: ${event.title}`}
				className={style.primaryLink}
				href={`/events/${event.slug}`}
			>
				View event
				<span aria-hidden="true">→</span>
			</Link>
		</li>
	);
}
