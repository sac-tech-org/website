import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { formatDateInTimeZone, formatDateKey } from "../../date-utils";
import type { Event, EventBlock } from "../../types";
import style from "./calendar.module.css";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarProps {
	events: Event[];
}

interface CalendarEntry {
	block: EventBlock;
	event: Event;
}

function getInitialMonth(events: Event[]) {
	const latestBlock = events
		.flatMap((event) => event.blocks)
		.sort((a, b) => b.starts_at.valueOf() - a.starts_at.valueOf())[0];

	if (!latestBlock) {
		throw new Error("The events calendar requires at least one dated event block.");
	}

	return dayjs(
		`${formatDateKey(latestBlock.starts_at, latestBlock.timezone).slice(0, 7)}-01`,
	);
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

export function Calendar({ events }: CalendarProps) {
	const [startMonth, setStartMonth] = useState(() => getInitialMonth(events));
	const [selectedDate, setSelectedDate] = useState<string | null>(null);

	const entriesByDate = useMemo(() => {
		const entries = new Map<string, CalendarEntry[]>();

		for (const event of events) {
			for (const block of event.blocks) {
				const key = formatDateKey(block.starts_at, block.timezone);
				entries.set(key, [...(entries.get(key) ?? []), { block, event }]);
			}
		}

		return entries;
	}, [events]);

	const months = useMemo(
		() => [0, 1, 2].map((offset) => startMonth.add(offset, "month")),
		[startMonth],
	);
	const selectedEntries = selectedDate
		? (entriesByDate.get(selectedDate) ?? [])
		: [];

	return (
		<section aria-labelledby="events-calendar-title" className={style.calendar}>
			<header className={style.calendarHeader}>
				<button
					aria-label="Show previous month"
					className={style.arrowButton}
					onClick={() => setStartMonth((month) => month.subtract(1, "month"))}
					type="button"
				>
					<span aria-hidden="true">‹</span>
				</button>
				<div className={style.headingGroup}>
					<h2 className={style.calendarHeading} id="events-calendar-title">
						Events calendar
					</h2>
					<p aria-live="polite" className={style.calendarRange}>
						Starting {startMonth.format("MMMM YYYY")}
					</p>
				</div>
				<button
					aria-label="Show next month"
					className={style.arrowButton}
					onClick={() => setStartMonth((month) => month.add(1, "month"))}
					type="button"
				>
					<span aria-hidden="true">›</span>
				</button>
			</header>

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

			{selectedDate && selectedEntries.length > 0 && (
				<div aria-live="polite" className={style.dayDetails}>
					<div>
						<p className={style.detailsEyebrow}>On this day</p>
						<h3>{dayjs(selectedDate).format("MMMM D, YYYY")}</h3>
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
									<a href={block.location_url}>Event details</a>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
