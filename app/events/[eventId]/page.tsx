import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { EventDescriptionMarkdown } from "@/components/event-description-markdown";
import { formatRecurrenceSummary } from "@/lib/events/format-recurrence-summary";
import { getApprovedEvents } from "@/lib/events/queries";
import { formatDateInTimeZone, formatDateKey } from "../date-utils";
import type { Event, EventBlock } from "../types";
import style from "./event-detail.module.css";
import { EventHeader } from "./event-header";

export const metadata: Metadata = {
	title: "Event details",
	description: "View the schedule and details for an approved SacTech event.",
};

interface EventDetailPageProps {
	params: Promise<{ eventId: string }>;
}

function sortedEventBlocks(event: Event) {
	return [...event.blocks].sort(
		(left, right) => left.starts_at.valueOf() - right.starts_at.valueOf(),
	);
}

function primaryEventBlock(event: Event) {
	const blocks = sortedEventBlocks(event);

	return blocks.find((block) => !block.recurrence_date) ?? blocks[0];
}

function formatBlockDate(block: EventBlock) {
	const options: Intl.DateTimeFormatOptions = {
		day: "numeric",
		month: "long",
		weekday: "long",
		year: "numeric",
	};
	const startsOn = formatDateInTimeZone(
		block.starts_at,
		block.timezone,
		options,
	);

	if (
		formatDateKey(block.starts_at, block.timezone) ===
		formatDateKey(block.ends_at, block.timezone)
	) {
		return startsOn;
	}

	return `${startsOn} through ${formatDateInTimeZone(
		block.ends_at,
		block.timezone,
		options,
	)}`;
}

function formatBlockTime(block: EventBlock) {
	const startsAt = formatDateInTimeZone(block.starts_at, block.timezone, {
		hour: "numeric",
		minute: "2-digit",
	});
	const endsAt = formatDateInTimeZone(block.ends_at, block.timezone, {
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});

	return `${startsAt}–${endsAt}`;
}

function eventRecurrenceSummary(event: Event, block: EventBlock | undefined) {
	const recurrence = event.recurrence_rule;

	if (!recurrence || !block) {
		return null;
	}

	return formatRecurrenceSummary({
		recurrenceCount: recurrence.occurrenceCount,
		recurrenceEndDate: recurrence.endDate,
		recurrenceEndType: recurrence.endType,
		recurrenceFrequency: recurrence.frequency,
		recurrenceInterval: recurrence.interval,
		recurrenceMonthlyPattern: recurrence.monthlyPattern,
		recurrenceWeekdays: recurrence.weekdays,
		startsAt: block.starts_at,
	});
}

function EventLocation({
	address,
	description,
}: {
	address?: string;
	description: string;
}) {
	if (!description && !address) {
		return <>Not available</>;
	}

	return (
		<>
			{description && <span>{description}</span>}
			{address && <address className={style.address}>{address}</address>}
		</>
	);
}

export function EventDetails({ event }: { event: Event }) {
	const blocks = sortedEventBlocks(event);
	const primaryBlock = primaryEventBlock(event);
	const recurrenceSummary = eventRecurrenceSummary(event, primaryBlock);
	const primaryLocationDescription =
		primaryBlock?.location_description || event.location_description;
	const primaryLocationAddress =
		primaryBlock?.location_address || event.location_address;

	return (
		<main className={style.page} id="main-content">
			<EventHeader
				imageUrl={event.banner_image}
				inPerson={event.in_person}
				isOnline={event.is_online}
				isRecurring={event.is_recurring}
				recurrenceRule={event.recurrence_rule}
				title={event.title}
			/>

			<div className={style.content}>
				<div className={style.primaryColumn}>
					<section aria-labelledby="about-event-title" className={style.about}>
						<p className={style.sectionEyebrow}>Event details</p>
						<h2 id="about-event-title">About this event</h2>
						<EventDescriptionMarkdown
							className={style.description}
							headingStartLevel={3}
							markdown={event.description}
						/>
					</section>

					<section
						aria-labelledby="event-schedule-title"
						className={style.schedule}
					>
						<header className={style.scheduleHeader}>
							<p className={style.sectionEyebrow}>Event schedule</p>
							<h2 id="event-schedule-title">
								{event.is_recurring
									? "Series timing and special dates"
									: "Date and time"}
							</h2>
						</header>

						{recurrenceSummary && (
							<p className={style.recurrenceSummary}>{recurrenceSummary}</p>
						)}

						{blocks.length > 0 ? (
							<ol className={style.scheduleList}>
								{blocks.map((block) => {
									const blockTitle = block.title || event.title;
									const blockDescription =
										block.description && block.description !== event.description
											? block.description
											: null;

									return (
										<li className={style.scheduleItem} key={block.slug}>
											<p className={style.occurrenceEyebrow}>
												{block.recurrence_date
													? "Updated occurrence"
													: event.is_recurring
														? "Series starts"
														: "Event date"}
											</p>
											<h3>{blockTitle}</h3>
											<dl className={style.scheduleFacts}>
												<div>
													<dt>Date</dt>
													<dd>
														<time dateTime={block.starts_at.toISOString()}>
															{formatBlockDate(block)}
														</time>
													</dd>
												</div>
												<div>
													<dt>Time</dt>
													<dd>
														<time dateTime={block.starts_at.toISOString()}>
															{formatBlockTime(block)}
														</time>
													</dd>
												</div>
												<div>
													<dt>Location</dt>
													<dd>
														<EventLocation
															address={block.location_address}
															description={block.location_description}
														/>
													</dd>
												</div>
											</dl>
											{blockDescription && (
												<EventDescriptionMarkdown
													className={style.occurrenceDescription}
													markdown={blockDescription}
												/>
											)}
											{block.recurrence_date &&
												block.location_url &&
												block.location_url !== event.location_url && (
													<a
														className={style.occurrenceLink}
														href={block.location_url}
														rel="noopener noreferrer"
														target="_blank"
													>
														Visit this occurrence&apos;s event page
														<span aria-hidden="true">↗</span>
													</a>
												)}
										</li>
									);
								})}
							</ol>
						) : (
							<p className={style.scheduleUnavailable}>
								Schedule details are not available.
							</p>
						)}
					</section>
				</div>

				<aside
					aria-labelledby="event-at-a-glance-title"
					className={style.aside}
				>
					<div className={style.detailsCard}>
						<p className={style.sectionEyebrow}>Plan your visit</p>
						<h2 id="event-at-a-glance-title">Event at a glance</h2>
						<dl className={style.detailsList}>
							<div>
								<dt>Date</dt>
								<dd>
									{primaryBlock ? (
										<time dateTime={primaryBlock.starts_at.toISOString()}>
											{formatBlockDate(primaryBlock)}
										</time>
									) : (
										"Not available"
									)}
								</dd>
							</div>
							<div>
								<dt>Time</dt>
								<dd>
									{primaryBlock
										? formatBlockTime(primaryBlock)
										: "Not available"}
								</dd>
							</div>
							<div>
								<dt>Location</dt>
								<dd>
									<EventLocation
										address={primaryLocationAddress}
										description={primaryLocationDescription}
									/>
								</dd>
							</div>
							{recurrenceSummary && (
								<div>
									<dt>Schedule</dt>
									<dd>{recurrenceSummary}</dd>
								</div>
							)}
						</dl>

						{event.location_url && (
							<a
								className={style.primaryLink}
								href={event.location_url}
								rel="noopener noreferrer"
								target="_blank"
							>
								Visit event page <span aria-hidden="true">↗</span>
							</a>
						)}
					</div>
				</aside>
			</div>
		</main>
	);
}

function EventDetailsFallback() {
	return (
		<main aria-busy="true" className={style.page} id="main-content">
			<section aria-labelledby="event-title" className={style.hero}>
				<div className={style.heroInner}>
					<Link className={style.backLink} href="/events">
						<span aria-hidden="true">←</span> Back to all events
					</Link>
					<div className={style.heroLayout}>
						<div className={style.heroCopy}>
							<p className={style.eyebrow}>Event details</p>
							<h1 id="event-title">Loading event details</h1>
							<p className={style.loadingIntro}>
								The latest approved event information will be ready in a moment.
							</p>
						</div>
					</div>
				</div>
			</section>
			<div className={style.loadingContent} role="status">
				<section className={style.loadingPanel}>
					<p className={style.sectionEyebrow}>Event details</p>
					<h2>Gathering the schedule and location</h2>
					<p>The event page is loading now.</p>
				</section>
				<aside className={style.loadingCard}>
					<p className={style.sectionEyebrow}>Plan your visit</p>
					<h2>Preparing event information</h2>
				</aside>
			</div>
		</main>
	);
}

async function EventDetailContent({ params }: EventDetailPageProps) {
	const { eventId } = await params;
	const parsedEventId = z.uuid().safeParse(eventId);

	if (!parsedEventId.success) {
		notFound();
	}

	const events = await getApprovedEvents();
	const event = events.find(({ slug }) => slug === parsedEventId.data);

	if (!event) {
		notFound();
	}

	return <EventDetails event={event} />;
}

export default function EventDetailPage({ params }: EventDetailPageProps) {
	return (
		<Suspense fallback={<EventDetailsFallback />}>
			<EventDetailContent params={params} />
		</Suspense>
	);
}
