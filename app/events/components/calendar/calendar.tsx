import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import {
	getNextOccurrence,
	getOccurrenceEnd,
	getOccurrencesInRange,
} from "@/lib/events/recurrence";
import { formatDateInTimeZone, formatDateKey } from "../../date-utils";
import type { Event, EventBlock } from "../../types";
import style from "./calendar.module.css";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarProps {
	events: Event[];
	referenceDate: string;
}

interface CalendarEntry {
	block: EventBlock;
	event: Event;
}

function getRecurrenceSeed(event: Event) {
	return [...event.blocks].sort(
		(left, right) => left.starts_at.valueOf() - right.starts_at.valueOf(),
	)[0];
}

function createOccurrenceBlock(seed: EventBlock, startsAt: Date): EventBlock {
	return {
		...seed,
		ends_at: getOccurrenceEnd(seed.starts_at, seed.ends_at, startsAt),
		slug: `${seed.slug}-${startsAt.toISOString()}`,
		starts_at: startsAt,
	};
}

function getInitialMonth(events: Event[], referenceDate: string) {
	const allBlocks = events.flatMap((event) => event.blocks);
	const upcomingBlocks = events
		.flatMap((event) => {
			const seed = getRecurrenceSeed(event);

			if (event.recurrence_rule && seed) {
				const nextOccurrence = getNextOccurrence(
					seed.starts_at,
					event.recurrence_rule,
					referenceDate,
				);

				return nextOccurrence
					? [createOccurrenceBlock(seed, nextOccurrence)]
					: [];
			}

			return event.blocks.filter(
				(block) =>
					formatDateKey(block.starts_at, block.timezone) >= referenceDate,
			);
		})
		.sort((a, b) => a.starts_at.valueOf() - b.starts_at.valueOf());
	const anchorBlock =
		upcomingBlocks[0] ??
		allBlocks.sort(
			(left, right) => left.starts_at.valueOf() - right.starts_at.valueOf(),
		).at(-1);

	if (anchorBlock) {
		return dayjs(
			`${formatDateKey(anchorBlock.starts_at, anchorBlock.timezone).slice(0, 7)}-01`,
		);
	}

	const referenceMonth = dayjs(`${referenceDate.slice(0, 7)}-01`);

	if (!referenceMonth.isValid()) {
		throw new Error("Invalid calendar reference date.");
	}

	return referenceMonth;
}

function formatMonthRange(startMonth: Dayjs, endMonth: Dayjs) {
	if (startMonth.year() === endMonth.year()) {
		return `${startMonth.format("MMMM")}–${endMonth.format("MMMM YYYY")}`;
	}

	return `${startMonth.format("MMMM YYYY")}–${endMonth.format("MMMM YYYY")}`;
}

function getMonthWeeks(month: Dayjs) {
	const days: Array<Dayjs | null> = [];

	for (let index = 0; index < month.day(); index += 1) {
		days.push(null);
	}

	for (let date = 1; date <= month.daysInMonth(); date += 1) {
		days.push(month.date(date));
	}

	while (days.length % 7 !== 0) {
		days.push(null);
	}

	return Array.from({ length: days.length / 7 }, (_, index) =>
		days.slice(index * 7, index * 7 + 7),
	);
}

export function Calendar({ events, referenceDate }: CalendarProps) {
	const [startMonth, setStartMonth] = useState(() =>
		getInitialMonth(events, referenceDate),
	);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const months = useMemo(
		() => [0, 1, 2].map((offset) => startMonth.add(offset, "month")),
		[startMonth],
	);
	const visibleRangeStart = months[0].format("YYYY-MM-DD");
	const visibleRangeEnd = months[2].endOf("month").format("YYYY-MM-DD");

	const entriesByDate = useMemo(() => {
		const entries = new Map<string, CalendarEntry[]>();

		for (const event of events) {
			const seed = getRecurrenceSeed(event);
			const visibleBlocks =
				event.recurrence_rule && seed
					? getOccurrencesInRange(
							seed.starts_at,
							event.recurrence_rule,
							visibleRangeStart,
							visibleRangeEnd,
						).map((occurrence) => createOccurrenceBlock(seed, occurrence))
					: event.blocks.filter((block) => {
							const key = formatDateKey(block.starts_at, block.timezone);
							return key >= visibleRangeStart && key <= visibleRangeEnd;
						});

			for (const block of visibleBlocks) {
				const key = formatDateKey(block.starts_at, block.timezone);
				entries.set(key, [...(entries.get(key) ?? []), { block, event }]);
			}
		}

		return entries;
	}, [events, visibleRangeEnd, visibleRangeStart]);

	const selectedEntries = selectedDate
		? (entriesByDate.get(selectedDate) ?? [])
		: [];
	const selectedDateLabel = selectedDate
		? dayjs(selectedDate).format("MMMM D, YYYY")
		: null;
	const selectedDayAnnouncement = selectedDateLabel
		? `Showing ${selectedEntries.length} ${selectedEntries.length === 1 ? "event" : "events"} for ${selectedDateLabel}.`
		: "";

	function moveCalendarWindow(monthOffset: number) {
		setSelectedDate(null);
		setStartMonth((month) => month.add(monthOffset, "month"));
	}

	return (
		<section
			aria-describedby={events.length === 0 ? "events-calendar-empty" : undefined}
			aria-labelledby="events-calendar-title"
			className={style.calendar}
		>
			<header className={style.calendarHeader}>
				<button
					aria-label="Show previous month"
					className={style.arrowButton}
					onClick={() => moveCalendarWindow(-1)}
					type="button"
				>
					<span aria-hidden="true">‹</span>
				</button>
				<div className={style.headingGroup}>
					<h2 className={style.calendarHeading} id="events-calendar-title">
						Events calendar
					</h2>
					<p aria-live="polite" className={style.calendarRange}>
						<span className={style.rangeThree}>
							{formatMonthRange(months[0], months[2])}
						</span>
						<span className={style.rangeTwo}>
							{formatMonthRange(months[0], months[1])}
						</span>
						<span className={style.rangeOne}>
							{months[0].format("MMMM YYYY")}
						</span>
					</p>
				</div>
				<button
					aria-label="Show next month"
					className={style.arrowButton}
					onClick={() => moveCalendarWindow(1)}
					type="button"
				>
					<span aria-hidden="true">›</span>
				</button>
			</header>

			<p
				aria-atomic="true"
				aria-live="polite"
				className={style.visuallyHidden}
				id="events-calendar-selection-status"
			>
				{selectedDayAnnouncement}
			</p>

			<div className={style.months}>
				{months.map((month) => (
					<table className={style.month} key={month.format("YYYY-MM")}>
						<caption>{month.format("MMMM YYYY")}</caption>
						<thead>
							<tr>
								{weekDays.map((day) => (
									<th key={day} scope="col">
										<span aria-hidden="true">{day.slice(0, 1)}</span>
										<span className={style.visuallyHidden}>{day}</span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{getMonthWeeks(month).map((week, weekIndex) => (
								<tr key={`${month.format("YYYY-MM")}-${weekIndex}`}>
									{week.map((date, dayIndex) => {
										if (!date) {
											return (
												<td
													aria-hidden="true"
													key={`blank-${dayIndex}`}
												/>
											);
										}

										const key = date.format("YYYY-MM-DD");
										const count = entriesByDate.get(key)?.length ?? 0;

										return (
											<td key={key}>
												{count > 0 ? (
													<button
														aria-controls={
															selectedDate === key
																? "events-calendar-day-details"
																: undefined
														}
														aria-label={`${date.format("MMMM D, YYYY")}, ${count} ${count === 1 ? "event" : "events"}`}
														aria-pressed={selectedDate === key}
														className={style.eventDay}
														onClick={() => setSelectedDate(key)}
														type="button"
													>
														{date.date()}
														<span aria-hidden="true" className={style.eventDot} />
													</button>
												) : (
													<span className={style.day}>{date.date()}</span>
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				))}
			</div>

			{events.length === 0 && (
				<p className={style.emptyNote} id="events-calendar-empty">
					No verified events are listed yet. You can still explore upcoming
					months while the schedule is updated.
				</p>
			)}

			{selectedDate && selectedDateLabel && selectedEntries.length > 0 && (
				<div
					aria-labelledby="events-calendar-day-details-title"
					className={style.dayDetails}
					id="events-calendar-day-details"
					role="region"
				>
					<div>
						<p className={style.detailsEyebrow}>On this day</p>
						<h3 id="events-calendar-day-details-title">
							{selectedDateLabel}
						</h3>
					</div>
					<ul role="list">
						{selectedEntries.map(({ block, event }) => (
							<li key={`${event.slug}-${block.slug}`}>
								<div>
									<strong>{event.title}</strong>
									<span>
										{formatDateInTimeZone(block.starts_at, block.timezone, {
											hour: "numeric",
											minute: "2-digit",
										})}
									</span>
								</div>
								{block.location_url && (
									<a
										aria-label={`View details for ${event.title}`}
										href={block.location_url}
									>
										Event details
									</a>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
