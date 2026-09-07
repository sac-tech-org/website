import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { CalendarEventData } from "@/lib/events/calendar-export";
import { CalendarActions } from "./calendar-actions";

const calendarEvent: CalendarEventData = {
	description: "A one-day design community event.",
	endsAt: "2026-09-05T21:00:00.000Z",
	id: "design-summit-20260905T190000Z",
	location: "The Urban Hive, 123 J Street, Sacramento, CA",
	startsAt: "2026-09-05T19:00:00.000Z",
	timeZone: "America/Los_Angeles",
	title: "Sacramento Design Summit",
	url: "https://events.example.com/design-summit",
};

describe("CalendarActions", () => {
	it("reveals Google Calendar and ICS actions from an accessible disclosure", async () => {
		const user = userEvent.setup();

		render(<CalendarActions calendarEvent={calendarEvent} />);
		const trigger = screen.getByRole("button", {
			name: "Add Sacramento Design Summit to calendar",
		});

		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(
			screen.queryByRole("link", { name: "Add to Google Calendar" }),
		).not.toBeInTheDocument();

		await user.click(trigger);

		expect(trigger).toHaveAttribute("aria-expanded", "true");
		const googleLink = screen.getByRole("link", {
			name: "Add to Google Calendar",
		});
		const googleUrl = new URL(googleLink.getAttribute("href") ?? "");

		expect(googleUrl.searchParams.get("dates")).toBe(
			"20260905T190000Z/20260905T210000Z",
		);
		expect(googleLink).toHaveAttribute("target", "_blank");
		expect(googleLink).toHaveAttribute("rel", "noopener noreferrer");
		expect(
			screen.getByRole("button", { name: "Download as ICS" }),
		).toBeVisible();
		googleLink.addEventListener("click", (event) => event.preventDefault(), {
			once: true,
		});
		await user.click(googleLink);
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(trigger).toHaveFocus();

		await user.click(trigger);
		await user.keyboard("{Escape}");
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(trigger).toHaveFocus();
	});

	it("downloads an ICS file using the event title and date", async () => {
		const user = userEvent.setup();
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValue("blob:calendar-download");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
		let downloadedLink: { download: string; href: string } | null = null;
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
			function captureDownload(this: HTMLAnchorElement) {
				downloadedLink = { download: this.download, href: this.href };
			},
		);

		render(<CalendarActions calendarEvent={calendarEvent} />);
		await user.click(
			screen.getByRole("button", {
				name: "Add Sacramento Design Summit to calendar",
			}),
		);
		await user.click(screen.getByRole("button", { name: "Download as ICS" }));

		expect(createObjectUrl).toHaveBeenCalledOnce();
		const downloadedBlob = createObjectUrl.mock.calls[0][0];

		if (!(downloadedBlob instanceof Blob)) {
			throw new Error("Expected the calendar download to use a Blob.");
		}

		expect(downloadedBlob.type).toBe("text/calendar;charset=utf-8");
		expect(await downloadedBlob.text()).toContain(
			"SUMMARY:Sacramento Design Summit",
		);
		expect(downloadedLink).toEqual({
			download: "2026-09-05-sacramento-design-summit.ics",
			href: "blob:calendar-download",
		});
	});
});
