"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calendar } from "./components/calendar/calendar";
import { NonRecurringEventsCard } from "./components/event-cards/non-recurring-event-card";
import { RecurringEventsCard } from "./components/event-cards/recurring-event-card";
import { LongWave } from "./components/long-wave/long-wave";
import { events } from "./constants";
import style from "./events-page.module.css";

type EventType = "all" | "online" | "in-person";

const eventFilters: Array<{ label: string; value: EventType }> = [
	{ label: "All events", value: "all" },
	{ label: "Online", value: "online" },
	{ label: "In person", value: "in-person" },
];

export default function EventsPage() {
	const [eventTypesToShow, setEventTypesToShow] =
		useState<EventType>("all");

	const filteredEvents = useMemo(() => {
		if (eventTypesToShow === "online") {
			return events.filter((event) => event.is_online);
		}

		if (eventTypesToShow === "in-person") {
			return events.filter((event) => event.in_person);
		}

		return events;
	}, [eventTypesToShow]);

	const recurringEvents = filteredEvents.filter((event) => event.is_recurring);
	const specialEvents = filteredEvents.filter((event) => !event.is_recurring);
	const hasEvents = recurringEvents.length > 0 || specialEvents.length > 0;
	const hasCalendarEntries = filteredEvents.some((event) => event.blocks.length > 0);

	return (
		<main className={style.container}>
			<header className={style.hero}>
				<div className={style.heroInner}>
					<Link className={style.backLink} href="/">
						<span aria-hidden="true">←</span> SacTech
					</Link>
					<p className={style.eyebrow}>Meet, learn, and build together</p>
					<h1 className={style.eventsTitle}>Events</h1>
					<p className={style.intro}>
						Find welcoming tech events online and around Sacramento. Pick a
						date or browse the full lineup below.
					</p>

					<fieldset className={style.filters}>
						<legend className={style.filterLegend}>
							<span aria-hidden="true" className={style.filterIcon}>
								≡
							</span>
							Show
						</legend>
						<div className={style.filterOptions}>
							{eventFilters.map((filter) => (
								<label className={style.filterLabel} key={filter.value}>
									<input
										checked={eventTypesToShow === filter.value}
										className={style.filterInput}
										name="event-type"
										onChange={() => setEventTypesToShow(filter.value)}
										type="radio"
										value={filter.value}
									/>
									<span>{filter.label}</span>
								</label>
							))}
						</div>
					</fieldset>
				</div>
				<LongWave />
			</header>

			<div className={style.content}>
				<p className={style.visuallyHidden} role="status">
					Showing {filteredEvents.length}{" "}
					{filteredEvents.length === 1 ? "event" : "events"}.
				</p>
				{hasCalendarEntries && (
					<Calendar events={filteredEvents} key={eventTypesToShow} />
				)}

				{recurringEvents.length > 0 && (
					<section className={style.listContainer}>
						<h2 className={style.listHeading}>Recurring events</h2>
						<ul className={style.list} role="list">
							{recurringEvents.map((event) => (
								<RecurringEventsCard event={event} key={event.slug} />
							))}
						</ul>
					</section>
				)}

				{specialEvents.length > 0 && (
					<section className={style.listContainer}>
						<h2 className={style.listHeading}>Special events</h2>
						<ul className={style.list} role="list">
							{specialEvents.map((event) => (
								<NonRecurringEventsCard event={event} key={event.slug} />
							))}
						</ul>
					</section>
				)}

				{!hasEvents && (
					<p className={style.emptyState}>
						There are no events in this category yet. Try another filter.
					</p>
				)}
			</div>
		</main>
	);
}
