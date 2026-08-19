import { within } from "@testing-library/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import { Calendar } from "./components/calendar/calendar";
import { RecurringEventsCard } from "./components/event-cards/recurring-event-card";
import EventsPage from "./events-page";
import type { Event, EventBlock, RecurrenceRule } from "./types";

function createBlock(
	overrides: Partial<EventBlock> & Pick<EventBlock, "starts_at" | "ends_at">,
): EventBlock {
	return {
		description: "A welcoming Sacramento technology gathering.",
		location_address: "123 J Street, Sacramento, CA",
		location_description: "Sacramento Central Library",
		location_url: "https://events.example.com/details",
		presenters: [],
		slug: "event-occurrence",
		timezone: SACRAMENTO_TIME_ZONE,
		title: "Event occurrence",
		...overrides,
	};
}

function weeklyRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
	return {
		endDate: null,
		endType: "after_occurrences",
		excludedDates: ["2026-09-09"],
		frequency: "week",
		interval: 1,
		monthlyPattern: null,
		occurrenceCount: 4,
		weekdays: [3],
		...overrides,
	};
}

function recurringEvent(overrides: Partial<Event> = {}): Event {
	return {
		blocks: [
			createBlock({
				ends_at: new Date("2026-09-02T18:00:00.000Z"),
				slug: "typescript-weekly-seed",
				starts_at: new Date("2026-09-02T17:00:00.000Z"),
				title: "Sacramento TypeScript Weekly",
			}),
		],
		description: "Practice TypeScript with Sacramento developers.",
		has_event_page: true,
		in_person: false,
		is_online: true,
		is_recurring: true,
		location_address: undefined,
		location_description: "Online",
		location_url: "https://events.example.com/details",
		organizers: [],
		recurrence_rule: weeklyRule(),
		slug: "sacramento-typescript-weekly",
		title: "Sacramento TypeScript Weekly",
		...overrides,
	};
}

function specialEvent(): Event {
	return {
		blocks: [
			createBlock({
				ends_at: new Date("2026-09-05T21:00:00.000Z"),
				location_description: "The Urban Hive",
				slug: "design-summit-occurrence",
				starts_at: new Date("2026-09-05T19:00:00.000Z"),
				title: "Sacramento Design Summit",
			}),
		],
		description: "A one-day design community event.",
		has_event_page: true,
		in_person: true,
		is_online: false,
		is_recurring: false,
		location_address: "123 J Street, Sacramento, CA",
		location_description: "The Urban Hive",
		location_url: "https://events.example.com/summit",
		organizers: [],
		recurrence_rule: null,
		slug: "sacramento-design-summit",
		title: "Sacramento Design Summit",
	};
}

describe("public events experience", () => {
	it("expands a series, omits its canceled date, and shows selected-day details", async () => {
		const user = userEvent.setup();

		render(<Calendar events={[recurringEvent()]} referenceDate="2026-09-01" />);
		const selectionStatus = document.getElementById(
			"events-calendar-selection-status",
		);
		expect(selectionStatus).not.toBeNull();
		expect(selectionStatus).toHaveAttribute("aria-live", "polite");
		expect(selectionStatus).toHaveTextContent("");

		expect(
			screen.getByRole("button", { name: "September 2, 2026, 1 event" }),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "September 9, 2026, 1 event" }),
		).not.toBeInTheDocument();
		const septemberSixteenth = screen.getByRole("button", {
			name: "September 16, 2026, 1 event",
		});
		expect(septemberSixteenth).toBeVisible();

		await user.click(septemberSixteenth);
		expect(septemberSixteenth).toHaveFocus();
		expect(septemberSixteenth).toHaveAttribute("aria-pressed", "true");
		expect(septemberSixteenth).toHaveAttribute(
			"aria-controls",
			"events-calendar-day-details",
		);
		expect(selectionStatus).toHaveTextContent(
			"Showing 1 event for September 16, 2026.",
		);
		const selectedDayDetails = screen.getByRole("region", {
			name: "September 16, 2026",
		});
		const selectedDay = within(selectedDayDetails);
		expect(selectedDay.getByText("Sacramento TypeScript Weekly")).toBeVisible();
		expect(selectedDay.getByText("10:00 AM")).toBeVisible();
		expect(
			selectedDay.getByRole("link", {
				name: "View details for Sacramento TypeScript Weekly",
			}),
		).toHaveAttribute("href", "https://events.example.com/details");
	});

	it("navigates the three-month calendar window", async () => {
		const user = userEvent.setup();

		render(<Calendar events={[recurringEvent()]} referenceDate="2026-09-01" />);
		expect(screen.getByRole("table", { name: "September 2026" })).toBeVisible();
		expect(screen.getByRole("table", { name: "November 2026" })).toBeVisible();

		await user.click(screen.getByRole("button", { name: "Show next month" }));

		expect(
			screen.queryByRole("table", { name: "September 2026" }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("table", { name: "December 2026" })).toBeVisible();
	});

	it("uses exclusions when choosing the next occurrence for the recurring card", () => {
		render(
			<ul>
				<RecurringEventsCard
					event={recurringEvent()}
					referenceDate="2026-09-09"
				/>
			</ul>,
		);

		const nextOccurrence = screen.getByText(/September 16/, {
			selector: "time",
		});
		expect(nextOccurrence).toHaveAttribute(
			"datetime",
			"2026-09-16T17:00:00.000Z",
		);
		expect(
			screen.queryByText(/September 9/, { selector: "time" }),
		).not.toBeInTheDocument();
	});

	it("renders one call to action when recurring-event links share a destination", () => {
		render(
			<ul>
				<RecurringEventsCard
					event={recurringEvent()}
					referenceDate="2026-09-01"
				/>
			</ul>,
		);

		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]).toHaveAccessibleName(
			"Online: Sacramento TypeScript Weekly",
		);
		expect(links[0]).toHaveAttribute(
			"href",
			"https://events.example.com/details",
		);
	});

	it("reports when exclusions consume every remaining finite occurrence", () => {
		const event = recurringEvent({
			recurrence_rule: weeklyRule({
				excludedDates: ["2026-09-02", "2026-09-09"],
				occurrenceCount: 2,
			}),
		});

		render(
			<ul>
				<RecurringEventsCard event={event} referenceDate="2026-09-01" />
			</ul>,
		);

		expect(screen.getByText("No upcoming dates are scheduled.")).toBeVisible();
	});

	it("filters both the calendar and event-card collections by attendance type", async () => {
		const user = userEvent.setup();

		render(
			<EventsPage
				events={[recurringEvent(), specialEvent()]}
				referenceDate="2026-09-01"
			/>,
		);
		const filterGroup = screen.getByRole("group", { name: "Show" });
		const filters = within(filterGroup);
		expect(
			screen.getByRole("link", { name: "Submit an event" }),
		).toHaveAttribute("href", "/account");
		expect(screen.getByRole("status")).toHaveTextContent(
			"Showing 2 events for all events.",
		);
		expect(
			screen.getByRole("heading", { name: "Sacramento TypeScript Weekly" }),
		).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "Sacramento Design Summit" }),
		).toBeVisible();

		await user.click(filters.getByText("Online"));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Showing 1 event for online.",
		);
		expect(
			screen.getByRole("heading", { name: "Sacramento TypeScript Weekly" }),
		).toBeVisible();
		expect(
			screen.queryByRole("heading", { name: "Sacramento Design Summit" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "September 2, 2026, 1 event" }),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "September 5, 2026, 1 event" }),
		).not.toBeInTheDocument();

		await user.click(filters.getByText("In person"));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Showing 1 event for in person.",
		);
		expect(
			screen.queryByRole("heading", { name: "Sacramento TypeScript Weekly" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Sacramento Design Summit" }),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "September 2, 2026, 1 event" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "September 16, 2026, 1 event" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "September 5, 2026, 1 event" }),
		).toBeVisible();
	});
});
