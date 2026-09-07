import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	createEventBlock,
	createRecurringEvent,
	createRecurringEventWithOverride,
	createSpecialEvent,
} from "@/stories/fixtures/events";

import { EventDetails } from "./event-details";

describe("EventDetails", () => {
	it("renders a one-time event with navigation and calendar actions", async () => {
		const user = userEvent.setup();

		render(
			<EventDetails
				event={createSpecialEvent({
					banner_image: "/events/design-summit/header-image",
					description: "# Agenda\n\nMeet Sacramento designers and builders.",
				})}
				referenceDate="2026-09-01"
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
		expect(screen.getByAltText("")).toHaveAttribute(
			"src",
			"/events/design-summit/header-image",
		);

		const externalLink = screen.getByRole("link", {
			name: "Visit event page",
		});
		expect(externalLink).toHaveAttribute(
			"href",
			"https://events.example.com/design-summit",
		);
		expect(externalLink).toHaveAttribute("target", "_blank");
		expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");

		await user.click(
			screen.getByRole("button", {
				name: "Add Sacramento Design Summit to calendar",
			}),
		);
		const googleLink = screen.getByRole("link", {
			name: "Add to Google Calendar",
		});
		const googleUrl = new URL(googleLink.getAttribute("href") ?? "");

		expect(googleUrl.searchParams.get("dates")).toBe(
			"20260905T190000Z/20260905T210000Z",
		);
		expect(
			screen.getByRole("button", { name: "Download as ICS" }),
		).toBeVisible();
	});

	it("exports the full date range for a multi-block event", async () => {
		const user = userEvent.setup();

		render(
			<EventDetails
				event={createSpecialEvent({
					blocks: [
						createEventBlock({
							ends_at: new Date("2026-09-05T21:00:00.000Z"),
							slug: "design-summit-day-one",
							starts_at: new Date("2026-09-05T19:00:00.000Z"),
							title: "Sacramento Design Summit",
						}),
						createEventBlock({
							ends_at: new Date("2026-09-06T20:00:00.000Z"),
							slug: "design-summit-day-two",
							starts_at: new Date("2026-09-06T17:00:00.000Z"),
							title: "Sacramento Design Summit",
						}),
					],
				})}
				referenceDate="2026-09-01"
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Add Sacramento Design Summit to calendar",
			}),
		);
		const googleUrl = new URL(
			screen
				.getByRole("link", { name: "Add to Google Calendar" })
				.getAttribute("href") ?? "",
		);

		expect(googleUrl.searchParams.get("dates")).toBe(
			"20260905T190000Z/20260906T200000Z",
		);
	});

	it("does not render image markup when an event has no header image", () => {
		const { container } = render(
			<EventDetails
				event={createSpecialEvent({ banner_image: undefined })}
				referenceDate="2026-09-01"
			/>,
		);

		expect(container.querySelector("img")).not.toBeInTheDocument();
	});

	it("omits calendar actions when an event has no dated block", () => {
		render(
			<EventDetails
				event={createSpecialEvent({
					blocks: [],
					location_url: undefined,
					title: "Future Community Showcase",
				})}
				referenceDate="2026-09-01"
			/>,
		);

		expect(
			screen.queryByRole("button", {
				name: "Add Future Community Showcase to calendar",
			}),
		).not.toBeInTheDocument();
	});

	it("collapses the image region when the header image cannot load", () => {
		const { container } = render(
			<EventDetails
				event={createSpecialEvent({
					banner_image: "/events/design-summit/missing-header-image",
				})}
				referenceDate="2026-09-01"
			/>,
		);
		const image = container.querySelector("img");

		expect(image).toBeInTheDocument();
		fireEvent.error(image as HTMLImageElement);
		expect(container.querySelector("img")).not.toBeInTheDocument();
	});

	it("exports the next valid recurring occurrence", async () => {
		const user = userEvent.setup();

		render(
			<EventDetails
				event={createRecurringEventWithOverride()}
				referenceDate="2026-09-09"
			/>,
		);

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

		await user.click(
			screen.getByRole("button", {
				name: "Add TypeScript Hands-on Night to calendar",
			}),
		);
		const googleUrl = new URL(
			screen
				.getByRole("link", { name: "Add to Google Calendar" })
				.getAttribute("href") ?? "",
		);

		expect(googleUrl.searchParams.get("dates")).toBe(
			"20260916T013000Z/20260916T030000Z",
		);
		expect(googleUrl.searchParams.get("text")).toBe(
			"TypeScript Hands-on Night",
		);
		expect(googleUrl.searchParams.get("location")).toBe(
			"The Urban Hive, 123 J Street, Sacramento, CA",
		);
	});

	it("omits calendar actions when a recurring series has ended", () => {
		render(
			<EventDetails
				event={createRecurringEvent()}
				referenceDate="2027-01-01"
			/>,
		);

		expect(
			screen.queryByRole("button", {
				name: "Add Sacramento TypeScript Weekly to calendar",
			}),
		).not.toBeInTheDocument();
	});
});
