import type { Event, EventBlock } from "@/app/events/types";

const GOOGLE_CALENDAR_EVENT_URL =
	"https://calendar.google.com/calendar/r/eventedit";

export interface CalendarEventData {
	description: string;
	endsAt: string;
	id: string;
	location: string;
	startsAt: string;
	timeZone: string;
	title: string;
	url?: string;
}

function validDate(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.valueOf())) {
		throw new TypeError("Calendar dates must be valid dates.");
	}

	return date;
}

function formatDateKeyInTimeZone(value: Date | string, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(validDate(value));
	const getPart = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;

	return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function locationForCalendar(
	event: Event,
	block: EventBlock,
): CalendarEventData["location"] {
	const name = block.location_description || event.location_description;
	const address =
		block.location_address ||
		(name === event.location_description ? event.location_address : undefined);

	return [...new Set([name, address].filter(Boolean))].join(", ");
}

export function toCalendarEvent(
	event: Event,
	block: EventBlock,
	endsAt = block.ends_at,
): CalendarEventData {
	return {
		description: block.description || event.description,
		endsAt: endsAt.toISOString(),
		id: event.is_recurring
			? `${event.slug}-occurrence-${block.recurrence_date ?? formatDateKeyInTimeZone(block.starts_at, block.timezone)}`
			: block.slug,
		location: locationForCalendar(event, block),
		startsAt: block.starts_at.toISOString(),
		timeZone: block.timezone,
		title: block.title || event.title,
		url: block.location_url || event.location_url,
	};
}

export function markdownToPlainText(markdown: string) {
	return markdown
		.replace(/\r\n?|\u2028|\u2029/g, "\n")
		.replace(
			/^[\t ]{0,3}(?:```|~~~)[^\n]*\n([\s\S]*?)^[\t ]{0,3}(?:```|~~~)[\t ]*$/gm,
			"$1",
		)
		.replace(/!\[([^\]]*)\]\([^\n)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+["'][^)]*["'])?\)/g, "$1 ($2)")
		.replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, "$1")
		.replace(/^[\t ]{0,3}#{1,6}[\t ]+/gm, "")
		.replace(/^[\t ]{0,3}>[\t ]?/gm, "")
		.replace(
			/^[\t ]{0,3}(?:(?:\*[\t ]*){3,}|(?:-[\t ]*){3,}|(?:_[\t ]*){3,})$/gm,
			"",
		)
		.replace(/^[\t ]{0,3}[-+*][\t ]+/gm, "• ")
		.replace(/^[\t ]{0,3}(\d+)[.)][\t ]+/gm, "$1. ")
		.replace(/\*\*([^*\n]+)\*\*/g, "$1")
		.replace(/__([^_\n]+)__/g, "$1")
		.replace(/~~([^~\n]+)~~/g, "$1")
		.replace(/`([^`\n]+)`/g, "$1")
		.replace(/(^|[^\w])\*([^*\n]+)\*(?=$|[^\w])/g, "$1$2")
		.replace(/(^|[^\w])_([^_\n]+)_(?=$|[^\w])/g, "$1$2")
		.replace(/\\([\\`*_[\]{}()#+\-.!>])/g, "$1")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function calendarDescription(event: CalendarEventData) {
	return [
		markdownToPlainText(event.description),
		event.url ? `More information: ${event.url}` : "",
	]
		.filter(Boolean)
		.join("\n\n");
}

export function formatUtcDate(value: Date | string) {
	return validDate(value)
		.toISOString()
		.replaceAll("-", "")
		.replaceAll(":", "")
		.replace(/\.\d{3}Z$/, "Z");
}

export function createGoogleCalendarUrl(event: CalendarEventData) {
	const url = new URL(GOOGLE_CALENDAR_EVENT_URL);

	url.searchParams.set("action", "TEMPLATE");
	url.searchParams.set(
		"dates",
		`${formatUtcDate(event.startsAt)}/${formatUtcDate(event.endsAt)}`,
	);
	url.searchParams.set("stz", event.timeZone);
	url.searchParams.set("etz", event.timeZone);
	url.searchParams.set("text", event.title);

	const description = calendarDescription(event);

	if (description) {
		url.searchParams.set("details", description);
	}

	if (event.location) {
		url.searchParams.set("location", event.location);
	}

	return url.toString();
}

function escapeIcsText(value: string) {
	return value
		.replaceAll("\\", "\\\\")
		.replace(/\r\n|\r|\n/g, "\\n")
		.replaceAll(",", "\\,")
		.replaceAll(";", "\\;");
}

function sanitizeIcsUri(value: string) {
	return value.replace(/[\r\n]/g, "");
}

function foldIcsLine(line: string) {
	const encoder = new TextEncoder();
	const foldedLines: string[] = [];
	let currentLine = "";
	let currentLineBytes = 0;

	for (const character of line) {
		const characterBytes = encoder.encode(character).length;

		if (currentLineBytes + characterBytes > 75) {
			foldedLines.push(currentLine);
			currentLine = ` ${character}`;
			currentLineBytes = 1 + characterBytes;
			continue;
		}

		currentLine += character;
		currentLineBytes += characterBytes;
	}

	foldedLines.push(currentLine);
	return foldedLines.join("\r\n");
}

export function createIcsContent(
	event: CalendarEventData,
	createdAt = new Date(),
) {
	const description = calendarDescription(event);
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//SacTech//Community Events//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-TIMEZONE:${escapeIcsText(event.timeZone)}`,
		"BEGIN:VEVENT",
		`UID:${escapeIcsText(event.id)}@sac-tech.org`,
		`DTSTAMP:${formatUtcDate(createdAt)}`,
		`DTSTART:${formatUtcDate(event.startsAt)}`,
		`DTEND:${formatUtcDate(event.endsAt)}`,
		`SUMMARY:${escapeIcsText(event.title)}`,
		...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
		...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
		...(event.url ? [`URL:${sanitizeIcsUri(event.url)}`] : []),
		"STATUS:CONFIRMED",
		"END:VEVENT",
		"END:VCALENDAR",
	];

	return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function createIcsFilename(event: CalendarEventData) {
	const title = event.title
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 64);
	const localDate = formatDateKeyInTimeZone(event.startsAt, event.timeZone);

	return `${localDate}-${title || "event"}.ics`;
}
