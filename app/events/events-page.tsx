"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BridgeArt } from "../../components/bridge-art";
import { Calendar } from "./components/calendar/calendar";
import { NonRecurringEventsCard } from "./components/event-cards/non-recurring-event-card";
import { RecurringEventsCard } from "./components/event-cards/recurring-event-card";
import type { Event } from "./types";
import style from "./events-page.module.css";

type EventType = "all" | "online" | "in-person";

interface EventsPageProps {
	events: Event[];
	referenceDate: string;
}

const eventFilters: Array<{ label: string; value: EventType }> = [
	{ label: "All events", value: "all" },
	{ label: "Online", value: "online" },
	{ label: "In person", value: "in-person" },
];

export default function EventsPage({ events, referenceDate }: EventsPageProps) {
	const [eventTypesToShow, setEventTypesToShow] = useState<EventType>("all");

	const filteredEvents = useMemo(() => {
		if (eventTypesToShow === "online") {
			return events.filter((event) => event.is_online);
		}

		if (eventTypesToShow === "in-person") {
			return events.filter((event) => event.in_person);
		}

		return events;
	}, [events, eventTypesToShow]);

	const recurringEvents = filteredEvents.filter((event) => event.is_recurring);
	const specialEvents = filteredEvents.filter((event) => !event.is_recurring);
	const hasEvents = recurringEvents.length > 0 || specialEvents.length > 0;
	const activeFilterLabel =
		eventFilters.find((filter) => filter.value === eventTypesToShow)?.label ??
		"All events";

	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="events-title" className={style.hero}>
				<div className={style.heroInner}>
					<div className={style.heroCopy}>
						<p className={style.eyebrow}>Gather by the river</p>
						<h1 id="events-title">Find your next local tech event.</h1>
						<p className={style.intro}>
							Meet people across the region who design, build, teach, and learn
							about technology. Browse what&apos;s scheduled now. We&apos;ll add
							more SacTech gatherings as their details are confirmed.
						</p>
					</div>
					<BridgeArt className={style.heroArt} compact />
				</div>
			</section>

			<div className={style.content}>
				<section
					aria-labelledby="calendar-section-title"
					className={style.schedule}
				>
					<header className={style.sectionHeader}>
						<div>
							<p className={style.sectionEyebrow}>Community calendar</p>
							<h2 id="calendar-section-title">See what&apos;s coming up</h2>
						</div>
						<p>Use the filters and month buttons to browse the schedule.</p>
					</header>

					<fieldset className={style.filters}>
						<legend className={style.filterLegend}>
							<span aria-hidden="true" className={style.filterIcon}>
								<span />
								<span />
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

					<p className={style.visuallyHidden} role="status">
						Showing {filteredEvents.length}{" "}
						{filteredEvents.length === 1 ? "event" : "events"} for{" "}
						{activeFilterLabel.toLowerCase()}.
					</p>

					<Calendar
						events={filteredEvents}
						key={eventTypesToShow}
						referenceDate={referenceDate}
					/>
				</section>

				{recurringEvents.length > 0 && (
					<section className={style.listContainer}>
						<h2 className={style.listHeading}>Recurring events</h2>
						<ul className={style.list} role="list">
							{recurringEvents.map((event) => (
								<RecurringEventsCard
									event={event}
									key={event.slug}
									referenceDate={referenceDate}
								/>
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
					<section
						aria-labelledby="schedule-update-title"
						className={style.emptyState}
					>
						<div>
							<p className={style.emptyEyebrow}>Schedule update</p>
							<h2 id="schedule-update-title">
								We&apos;re still confirming the next SacTech dates.
							</h2>
							<p>
								We&apos;ll add events once their dates, locations, and ways to
								join are confirmed.
							</p>
						</div>
					</section>
				)}

				<section
					aria-labelledby="events-community-title"
					className={style.communityCallout}
				>
					<div>
						<p className={style.calloutEyebrow}>Between gatherings</p>
						<h2 id="events-community-title">Stay connected between events.</h2>
						<p>
							Join SacTech to meet people nearby, share what you know, and hear
							when new events are announced.
						</p>
					</div>
					<Link className={style.communityLink} href="/#join">
						Join the community <span aria-hidden="true">→</span>
					</Link>
				</section>

				<section className={style.submitCallout}>
					<div>
						<p className={style.calloutEyebrow}>Share an event</p>
						<h2>Planning a local tech event?</h2>
						<p>
							Create an account and send us the details. A SacTech reviewer will
							review the event before it appears on the calendar.
						</p>
					</div>
					<Link className={style.submitLink} href="/account">
						Submit an event <span aria-hidden="true">→</span>
					</Link>
				</section>
			</div>
		</main>
	);
}
