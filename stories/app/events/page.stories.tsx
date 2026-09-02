import preview from "@/.storybook/preview";
import EventsPage, { EventsCallouts } from "@/app/events/events-page";
import style from "@/app/events/events-page.module.css";
import type { Event } from "@/app/events/types";
import { BridgeArt } from "@/components/bridge-art";
import {
	EVENT_STORY_REFERENCE_DATE,
	MIXED_EVENTS,
} from "@/stories/fixtures/events";

interface EventsRoutePreviewProps {
	events: Event[];
	referenceDate: string;
}

function EventsRoutePreview({
	events,
	referenceDate,
}: EventsRoutePreviewProps) {
	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="events-title" className={style.hero}>
				<div className={style.heroInner}>
					<div className={style.heroCopy}>
						<p className={style.eyebrow}>Gather by the river</p>
						<h1 id="events-title">Find your next local tech event.</h1>
						<p className={style.intro}>
							Meet people across the region who design, build, teach, and learn
							about technology. Browse what&apos;s scheduled now.
						</p>
					</div>
					<BridgeArt className={style.heroArt} compact />
				</div>
			</section>

			<div className={style.content}>
				<EventsPage events={events} referenceDate={referenceDate} />
				<EventsCallouts />
			</div>
		</main>
	);
}

const meta = preview.meta({
	component: EventsRoutePreview,
	title: "Pages/Events",
	parameters: {
		layout: "fullscreen",
	},
	args: {
		events: MIXED_EVENTS,
		referenceDate: EVENT_STORY_REFERENCE_DATE,
	},
});

export const PopulatedCalendar = meta.story({});

export const EmptyCalendar = PopulatedCalendar.extend({
	args: {
		events: [],
	},
});

export const LoadingCalendar = PopulatedCalendar.extend({
	render: () => (
		<main className={style.page} id="main-content">
			<section aria-labelledby="events-title" className={style.hero}>
				<div className={style.heroInner}>
					<div className={style.heroCopy}>
						<p className={style.eyebrow}>Gather by the river</p>
						<h1 id="events-title">Find your next local tech event.</h1>
					</div>
					<BridgeArt className={style.heroArt} compact />
				</div>
			</section>
			<div className={style.content}>
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
					</header>
					<div className={style.emptyState} role="status">
						<div>
							<p className={style.emptyEyebrow}>Loading schedule</p>
							<h2>Gathering the latest event details.</h2>
							<p>The community calendar will be ready in a moment.</p>
						</div>
					</div>
				</section>
				<EventsCallouts />
			</div>
		</main>
	),
});
