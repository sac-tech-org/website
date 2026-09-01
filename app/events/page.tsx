import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { BridgeArt } from "@/components/bridge-art";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import { getApprovedEvents } from "@/lib/events/queries";
import { formatDateKey } from "./date-utils";
import EventsPage, { EventsCallouts } from "./events-page";
import style from "./events-page.module.css";

export const metadata: Metadata = {
	title: "Events",
	description:
		"Browse approved Sacramento technology events and check back as more dates are confirmed.",
};

async function EventsResults() {
	await io();

	const currentSacramentoDate = formatDateKey(new Date(), SACRAMENTO_TIME_ZONE);
	const events = await getApprovedEvents();

	return <EventsPage events={events} referenceDate={currentSacramentoDate} />;
}

function EventsResultsFallback() {
	return (
		<section
			aria-busy="true"
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
			<div className={style.emptyState} role="status">
				<div>
					<p className={style.emptyEyebrow}>Loading schedule</p>
					<h2>Gathering the latest event details.</h2>
					<p>The community calendar will be ready in a moment.</p>
				</div>
			</div>
		</section>
	);
}

export default function EventsRoute() {
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
				<Suspense fallback={<EventsResultsFallback />}>
					<EventsResults />
				</Suspense>
				<EventsCallouts />
			</div>
		</main>
	);
}
