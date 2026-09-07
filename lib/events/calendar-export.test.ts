import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
	createRecurringEvent,
	createSpecialEvent,
} from "@/stories/fixtures/events";
import {
	createGoogleCalendarUrl,
	createIcsContent,
	createIcsFilename,
	formatUtcDate,
	markdownToPlainText,
	toCalendarEvent,
	type CalendarEventData,
} from "./calendar-export";

const calendarEvent: CalendarEventData = {
	description: "Bring R&D notes & questions.",
	endsAt: "2026-09-05T21:00:00.000Z",
	id: "event-123-20260905T190000Z",
	location: "Café Hall, 123 J Street",
	startsAt: "2026-09-05T19:00:00.000Z",
	timeZone: "America/Los_Angeles",
	title: "Design & Build #1",
	url: "https://events.example.com/design?a=1&b=2",
};

describe("calendar exports", () => {
	it("builds a Google Calendar template with exact instants and timezone", () => {
		const url = new URL(createGoogleCalendarUrl(calendarEvent));

		expect(url.origin).toBe("https://calendar.google.com");
		expect(url.pathname).toBe("/calendar/r/eventedit");
		expect(url.searchParams.get("action")).toBe("TEMPLATE");
		expect(url.searchParams.get("dates")).toBe(
			"20260905T190000Z/20260905T210000Z",
		);
		expect(url.searchParams.get("stz")).toBe("America/Los_Angeles");
		expect(url.searchParams.get("etz")).toBe("America/Los_Angeles");
		expect(url.searchParams.get("text")).toBe("Design & Build #1");
		expect(url.searchParams.get("location")).toBe("Café Hall, 123 J Street");
		expect(url.searchParams.get("details")).toBe(
			"Bring R&D notes & questions.\n\nMore information: https://events.example.com/design?a=1&b=2",
		);
	});

	it("creates a standards-shaped ICS file with escaped text and stable values", () => {
		const content = createIcsContent(
			{
				...calendarEvent,
				description: "First line\r\nSecond; line, with a \\ slash.",
				location: "Café, Hall; A",
				title: "Design, Build; Share\\Learn",
			},
			new Date("2026-08-30T12:34:56.789Z"),
		);
		const unfolded = content.replaceAll("\r\n ", "");

		expect(unfolded).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
		expect(unfolded).toContain(
			"UID:event-123-20260905T190000Z@sac-tech.org\r\n",
		);
		expect(unfolded).toContain("DTSTAMP:20260830T123456Z\r\n");
		expect(unfolded).toContain("DTSTART:20260905T190000Z\r\n");
		expect(unfolded).toContain("DTEND:20260905T210000Z\r\n");
		expect(unfolded).toContain("SUMMARY:Design\\, Build\\; Share\\\\Learn\r\n");
		expect(unfolded).toContain(
			"DESCRIPTION:First line Second\\; line\\, with a \\\\ slash.\\n\\nMore information: https://events.example.com/design?a=1&b=2\r\n",
		);
		expect(unfolded).toContain("LOCATION:Café\\, Hall\\; A\r\n");
		expect(unfolded).toContain(
			"URL:https://events.example.com/design?a=1&b=2\r\n",
		);
		expect(content.endsWith("END:VCALENDAR\r\n")).toBe(true);
		expect(content.replaceAll("\r\n", "")).not.toContain("\n");
	});

	it("folds every physical ICS line to at most 75 UTF-8 bytes", () => {
		const content = createIcsContent(
			{ ...calendarEvent, title: "é".repeat(60) },
			new Date("2026-08-30T12:34:56.789Z"),
		);
		const lines = content.split("\r\n").filter(Boolean);

		expect(lines.some((line) => line.startsWith(" "))).toBe(true);
		for (const line of lines) {
			expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
		}
	});

	it("normalizes an event block for both export formats", () => {
		const event = createSpecialEvent();
		const block = event.blocks[0];
		const result = toCalendarEvent(event, block);

		expect(result).toEqual({
			description: event.description,
			endsAt: "2026-09-05T21:00:00.000Z",
			id: "design-summit-occurrence",
			location: "The Urban Hive, 123 J Street, Sacramento, CA",
			startsAt: "2026-09-05T19:00:00.000Z",
			timeZone: "America/Los_Angeles",
			title: event.title,
			url: "https://events.example.com/design-summit",
		});
		expect(createIcsFilename(result)).toBe(
			"2026-09-05-sacramento-design-summit.ics",
		);
		expect(formatUtcDate(result.startsAt)).toBe("20260905T190000Z");
	});

	it("uses the event timezone rather than UTC in the download filename", () => {
		expect(
			createIcsFilename({
				...calendarEvent,
				startsAt: "2026-09-16T01:30:00.000Z",
				title: "TypeScript Hands-on Night",
			}),
		).toBe("2026-09-15-typescript-hands-on-night.ics");
	});

	it("turns common Markdown formatting into readable calendar text", () => {
		const markdown = [
			"# What to expect",
			"",
			"Meet **designers** and [read the guide](https://example.com/guide).",
			"",
			"- Bring a `laptop`",
			"- Share *one idea*",
		].join("\n");

		expect(markdownToPlainText(markdown)).toBe(
			[
				"What to expect",
				"",
				"Meet designers and read the guide (https://example.com/guide).",
				"",
				"• Bring a laptop",
				"• Share one idea",
			].join("\n"),
		);
	});

	it("parses reference links, image text, lists, and autolinks structurally", () => {
		const markdown = [
			"![SacTech bridge][logo]",
			"",
			"Read [the guide][guide].",
			"",
			"3. Arrive",
			"4. Meet neighbors",
			"",
			"Contact <team@example.com> or visit <https://example.com>.",
			"",
			"[logo]: https://example.com/logo.png",
			"[guide]: https://example.com/guide",
		].join("\n");

		expect(markdownToPlainText(markdown)).toBe(
			[
				"SacTech bridge",
				"",
				"Read the guide (https://example.com/guide).",
				"",
				"3. Arrive",
				"4. Meet neighbors",
				"",
				"Contact team@example.com or visit https://example.com.",
			].join("\n"),
		);
	});

	it("does not leak a series address into an online occurrence", () => {
		const event = createSpecialEvent();
		const block = {
			...event.blocks[0],
			in_person: false,
			is_online: true,
			location_address: undefined,
			location_description: "Online",
		};

		expect(toCalendarEvent(event, block).location).toBe("Online");
	});

	it("keeps a recurring occurrence UID stable when only its time changes", () => {
		const event = createRecurringEvent();
		const seed = event.blocks[0];
		const firstTime = new Date("2026-09-02T17:00:00.000Z");
		const correctedTime = new Date("2026-09-02T18:00:00.000Z");
		const firstOccurrence = {
			...seed,
			slug: `${seed.slug}-${firstTime.toISOString()}`,
			starts_at: firstTime,
		};
		const correctedOccurrence = {
			...seed,
			slug: `${seed.slug}-${correctedTime.toISOString()}`,
			starts_at: correctedTime,
		};

		expect(toCalendarEvent(event, firstOccurrence).id).toBe(
			"sacramento-typescript-weekly-occurrence-2026-09-02",
		);
		expect(toCalendarEvent(event, correctedOccurrence).id).toBe(
			toCalendarEvent(event, firstOccurrence).id,
		);
	});
});
