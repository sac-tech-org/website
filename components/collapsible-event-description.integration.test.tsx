import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { CollapsibleEventDescription } from "./collapsible-event-description";

describe("CollapsibleEventDescription", () => {
	it("leaves descriptions of exactly 300 characters fully visible", () => {
		const markdown = "A".repeat(300);

		render(
			<CollapsibleEventDescription
				eventTitle="Short event"
				markdown={markdown}
			/>,
		);

		expect(screen.getByText(markdown)).toBeVisible();
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});

	it("expands and collapses long formatted descriptions", async () => {
		const user = userEvent.setup();
		render(
			<CollapsibleEventDescription
				eventTitle="Long event"
				markdown={`${"A".repeat(295)} **bold tail**\n\n[Event details](https://events.example.com/details)`}
			/>,
		);

		const showMore = screen.getByRole("button", {
			name: "Show more details for Long event",
		});
		const descriptionId = showMore.getAttribute("aria-controls");
		expect(descriptionId).not.toBeNull();
		expect(document.getElementById(descriptionId!)).not.toBeNull();
		expect(showMore).toHaveAttribute("aria-expanded", "false");
		expect(screen.getByText("bold…").tagName).toBe("STRONG");
		expect(
			screen.queryByRole("link", { name: "Event details" }),
		).not.toBeInTheDocument();

		await user.click(showMore);

		const showLess = screen.getByRole("button", {
			name: "Show less details for Long event",
		});
		expect(showLess).toHaveAttribute("aria-expanded", "true");
		expect(showLess).toHaveFocus();
		expect(screen.getByText("bold tail").tagName).toBe("STRONG");
		expect(screen.getByRole("link", { name: "Event details" })).toHaveAttribute(
			"href",
			"https://events.example.com/details",
		);

		await user.click(showLess);

		expect(
			screen.getByRole("button", {
				name: "Show more details for Long event",
			}),
		).toHaveFocus();
		expect(
			screen.queryByRole("link", { name: "Event details" }),
		).not.toBeInTheDocument();
	});
});
