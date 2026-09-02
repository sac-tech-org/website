import preview from "@/.storybook/preview";
import EventsPage, { EventsCallouts } from "@/app/events/events-page";
import style from "@/app/events/events-page.module.css";
import type { Event } from "@/app/events/types";
import { BridgeArt } from "@/components/bridge-art";
import {
	createRecurringEvent,
	createSpecialEvent,
	EVENT_STORY_REFERENCE_DATE,
	MIXED_EVENTS,
} from "@/stories/fixtures/events";
import { expect } from "storybook/test";

const eventImageUrl = "/images/opengraph/sactech-sticker.png";
const eventTitles = [
	"Sacramento TypeScript Weekly",
	"Sacramento AI Builders",
	"Sacramento Design Summit",
	"Civic Tech Demo Night",
] as const;

function createImageScenario(
	imagePresence: [boolean, boolean, boolean, boolean],
) {
	return [
		createRecurringEvent({
			banner_image: imagePresence[0] ? eventImageUrl : undefined,
			slug: "sacramento-typescript-weekly",
			title: eventTitles[0],
		}),
		createRecurringEvent({
			banner_image: imagePresence[1] ? eventImageUrl : undefined,
			description: "Build useful AI projects with Sacramento technologists.",
			slug: "sacramento-ai-builders",
			title: eventTitles[1],
		}),
		createSpecialEvent({
			banner_image: imagePresence[2] ? eventImageUrl : undefined,
			slug: "sacramento-design-summit",
			title: eventTitles[2],
		}),
		createSpecialEvent({
			banner_image: imagePresence[3] ? eventImageUrl : undefined,
			description: "See practical civic technology projects from local teams.",
			slug: "civic-tech-demo-night",
			title: eventTitles[3],
		}),
	].map((event) => ({
		...event,
		blocks: event.blocks.map((block, index) => ({
			...block,
			slug: `${event.slug}-${index + 1}`,
		})),
	}));
}

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

export const AllEventsHaveImages = PopulatedCalendar.extend({
	args: {
		events: createImageScenario([true, true, true, true]),
	},
	play: async ({ canvas }) => {
		for (const title of eventTitles) {
			const card = canvas
				.getByRole("link", { name: `View event: ${title}` })
				.closest("li");

			if (!card) {
				throw new Error(`Expected an event card for ${title}.`);
			}

			await expect(card.querySelector("img")).toHaveAttribute("alt", "");
			await expect(card.querySelector("img")).toHaveAttribute(
				"src",
				eventImageUrl,
			);
		}
	},
});

export const NoEventsHaveImages = PopulatedCalendar.extend({
	args: {
		events: createImageScenario([false, false, false, false]),
	},
	play: async ({ canvas }) => {
		for (const title of eventTitles) {
			const card = canvas
				.getByRole("link", { name: `View event: ${title}` })
				.closest("li");

			if (!card) {
				throw new Error(`Expected an event card for ${title}.`);
			}

			await expect(card.querySelector("img")).not.toBeInTheDocument();
		}
	},
});

export const MixedImagePresence = PopulatedCalendar.extend({
	args: {
		events: createImageScenario([true, false, true, false]),
	},
	play: async ({ canvas }) => {
		for (const [index, title] of eventTitles.entries()) {
			const card = canvas
				.getByRole("link", { name: `View event: ${title}` })
				.closest("li");

			if (!card) {
				throw new Error(`Expected an event card for ${title}.`);
			}

			if (index % 2 === 0) {
				await expect(card.querySelector("img")).toHaveAttribute(
					"src",
					eventImageUrl,
				);
			} else {
				await expect(card.querySelector("img")).not.toBeInTheDocument();
			}
		}
	},
});

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
