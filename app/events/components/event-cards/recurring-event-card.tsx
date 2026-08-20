import { getNextOccurrence, getOccurrenceEnd } from "@/lib/events/recurrence";
import { CollapsibleEventDescription } from "@/components/collapsible-event-description";
import { formatDateInTimeZone, formatDateKey } from "../../date-utils";
import { EventChip } from "../event-chip/event-chip";
import type { RecurringEventsCardProps } from "./types";
import style from "./recurring-event-card.module.css";

export function RecurringEventsCard({
	event,
	referenceDate,
}: RecurringEventsCardProps) {
	const seed = event.blocks
		.filter((block) => !block.recurrence_date)
		.sort(
			(left, right) => left.starts_at.valueOf() - right.starts_at.valueOf(),
		)[0];
	const nextStart =
		event.recurrence_rule && seed
			? getNextOccurrence(seed.starts_at, event.recurrence_rule, referenceDate)
			: null;
	const nextBaseBlock =
		seed && nextStart
			? {
					...seed,
					ends_at: getOccurrenceEnd(seed.starts_at, seed.ends_at, nextStart),
					slug: `${seed.slug}-${nextStart.toISOString()}`,
					starts_at: nextStart,
				}
			: null;
	const upcomingOverrides = event.blocks.filter(
		(block) =>
			block.recurrence_date &&
			formatDateKey(block.starts_at, block.timezone) >= referenceDate,
	);
	const featuredBlock = [
		...(nextBaseBlock ? [nextBaseBlock] : []),
		...upcomingOverrides,
	].sort(
		(left, right) => left.starts_at.valueOf() - right.starts_at.valueOf(),
	)[0];
	const featuredTitle = featuredBlock?.title ?? event.title;
	const featuredDescription = featuredBlock?.description ?? event.description;
	const featuredInPerson = featuredBlock?.in_person ?? event.in_person;
	const featuredIsOnline = featuredBlock?.is_online ?? event.is_online;
	const featuredLocationDescription =
		featuredBlock?.location_description ?? event.location_description;
	const featuredLocationUrl = featuredBlock
		? featuredBlock.location_url
		: event.location_url;

	return (
		<li className={style.card}>
			<div className={style.cardTopline}>
				<span aria-hidden="true" className={style.accentMark} />
				<span>Recurring</span>
			</div>
			<h3 className={style.title}>{featuredTitle}</h3>

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
					<span className={style.dateStatus}>Next date</span>
				</p>
			) : (
				<p className={style.eventDate}>
					There aren&apos;t any upcoming dates yet.
				</p>
			)}

			<ul aria-label="Event type" className={style.chips}>
				{featuredInPerson && (
					<li>
						<EventChip size="compact" variant="in-person" />
					</li>
				)}
				{featuredIsOnline && (
					<li>
						<EventChip size="compact" variant="online" />
					</li>
				)}
			</ul>

			<CollapsibleEventDescription
				className={style.description}
				eventTitle={featuredTitle}
				markdown={featuredDescription}
			/>

			{featuredBlock?.location_description && (
				<div className={style.topicCard}>
					<div>
						<span>Next location</span>
						<strong>{featuredBlock.location_description}</strong>
					</div>
				</div>
			)}

			{featuredLocationUrl && featuredLocationDescription && (
				<a
					aria-label={`${featuredLocationDescription}: ${featuredTitle}`}
					className={style.primaryLink}
					href={featuredLocationUrl}
				>
					{featuredLocationDescription}
					<span aria-hidden="true">→</span>
				</a>
			)}
		</li>
	);
}
