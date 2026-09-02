import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	createRecurringEventWithOverride,
	createSpecialEvent,
} from "@/stories/fixtures/events";

vi.mock("@/lib/events/queries", () => ({
	getApprovedEvents: vi.fn(),
}));

import { EventDetails } from "./page";

describe("EventDetails", () => {
	it("renders a one-time event with its first-party and external navigation", () => {
		render(
			<EventDetails
				event={createSpecialEvent({
					description: "# Agenda\n\nMeet Sacramento designers and builders.",
				})}
			/>,
		);

		expect(
			screen.getByRole("heading", {
				level: 1,
				name: "Sacramento Design Summit",
			}),
		).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Back to all events" }),
		).toHaveAttribute("href", "/events");
		expect(
			screen.getByRole("heading", { level: 3, name: "Agenda" }),
		).toBeVisible();
		expect(screen.getAllByText("123 J Street, Sacramento, CA")).toHaveLength(2);
		expect(screen.getAllByText("Saturday, September 5, 2026")).toHaveLength(2);

		const externalLink = screen.getByRole("link", {
			name: "Visit event page",
		});
		expect(externalLink).toHaveAttribute(
			"href",
			"https://events.example.com/design-summit",
		);
		expect(externalLink).toHaveAttribute("target", "_blank");
		expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("explains a recurring schedule without inventing future occurrences", () => {
		render(<EventDetails event={createRecurringEventWithOverride()} />);

		expect(
			screen.getAllByText("Every week on Wednesday for 8 occurrences"),
		).toHaveLength(2);
		expect(screen.getByText("Series starts")).toBeVisible();
		expect(screen.getByText("Updated occurrence")).toBeVisible();
		expect(screen.getByText("Every week")).toBeVisible();
		expect(screen.getAllByText("Online").length).toBeGreaterThan(0);
		expect(
			screen.getByRole("link", {
				name: "Visit this occurrence's event page",
			}),
		).toHaveAttribute("href", "https://events.example.com/hands-on-night");
	});
});
