import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import { getApprovedEvents } from "@/lib/events/queries";
import { formatDateKey } from "../date-utils";
import style from "./event-detail.module.css";
import { EventDetails } from "./event-details";

export const metadata: Metadata = {
	title: "Event details",
	description: "View the schedule and details for an approved SacTech event.",
};

interface EventDetailPageProps {
	params: Promise<{ eventId: string }>;
}

function EventDetailsFallback() {
	return (
		<main aria-busy="true" className={style.page} id="main-content">
			<section aria-labelledby="event-title" className={style.hero}>
				<div className={style.heroInner}>
					<Link className={style.backLink} href="/events">
						<ArrowLeft aria-hidden="true" size={16} />
						Back to all events
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
	await io();

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

	const currentSacramentoDate = formatDateKey(new Date(), SACRAMENTO_TIME_ZONE);

	return <EventDetails event={event} referenceDate={currentSacramentoDate} />;
}

export default function EventDetailPage({ params }: EventDetailPageProps) {
	return (
		<Suspense fallback={<EventDetailsFallback />}>
			<EventDetailContent params={params} />
		</Suspense>
	);
}
