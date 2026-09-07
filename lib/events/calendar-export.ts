import type { Element, Root, RootContent } from "hast";
import { toText } from "hast-util-to-text";
import { createEvent } from "ics";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import type { Event, EventBlock } from "@/app/events/types";

const GOOGLE_CALENDAR_EVENT_URL =
	"https://calendar.google.com/calendar/r/eventedit";
const utcDateTimeFormatter = new Intl.DateTimeFormat(
	"en-US-u-ca-gregory-nu-latn",
	{
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone: "UTC",
		year: "numeric",
	},
);

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

function dateTimePart(
	parts: Intl.DateTimeFormatPart[],
	type: Intl.DateTimeFormatPartTypes,
) {
	const value = parts.find((part) => part.type === type)?.value;

	if (value === undefined) {
		throw new Error(`Could not format the calendar date ${type}.`);
	}

	return value;
}

function formatDateKeyInTimeZone(value: Date | string, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(validDate(value));

	return `${dateTimePart(parts, "year")}-${dateTimePart(parts, "month")}-${dateTimePart(parts, "day")}`;
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

function isListItem(node: RootContent): node is Element {
	return node.type === "element" && node.tagName === "li";
}

function linkAlreadyShowsDestination(label: string, href: string) {
	return (
		label === href ||
		href === `mailto:${label}` ||
		(label.startsWith("www.") &&
			(href === `http://${label}` || href === `https://${label}`))
	);
}

function prependListMarker(node: Element, marker: string) {
	const firstChild = node.children[0];
	const markerParent =
		firstChild?.type === "element" && firstChild.tagName === "p"
			? firstChild
			: node;

	markerParent.children.unshift({ type: "text", value: marker });
}

function rehypeCalendarText() {
	return (tree: Root) => {
		visit(tree, "element", (node, index, parent) => {
			if (node.tagName === "a") {
				const href = node.properties.href;
				const label = toText(node).trim();

				if (
					typeof href === "string" &&
					!linkAlreadyShowsDestination(label, href)
				) {
					node.children.push({ type: "text", value: ` (${href})` });
				}

				return;
			}

			if (
				node.tagName === "li" &&
				parent?.type === "element" &&
				(parent.tagName === "ol" || parent.tagName === "ul")
			) {
				const precedingItems = parent.children
					.slice(0, index)
					.filter(isListItem).length;
				const configuredStart = parent.properties.start;
				const start =
					parent.tagName === "ol" && typeof configuredStart === "number"
						? configuredStart
						: 1;
				const marker =
					parent.tagName === "ol" ? `${start + precedingItems}. ` : "• ";

				prependListMarker(node, marker);
				return;
			}

			if (node.tagName === "img" && parent && typeof index === "number") {
				const alt = node.properties.alt;
				parent.children[index] = {
					type: "text",
					value: typeof alt === "string" ? alt : "",
				};

				return SKIP;
			}
		});
	};
}

const markdownToTextProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype)
	.use(rehypeCalendarText)
	.freeze();

export function markdownToPlainText(markdown: string) {
	const normalizedMarkdown = markdown
		.replaceAll("\r\n", "\n")
		.replaceAll("\r", "\n")
		.replaceAll("\u2028", "\n")
		.replaceAll("\u2029", "\n");
	const tree = markdownToTextProcessor.runSync(
		markdownToTextProcessor.parse(normalizedMarkdown),
	);

	return toText(tree).trim();
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
	const parts = utcDateTimeFormatter.formatToParts(validDate(value));

	return [
		dateTimePart(parts, "year"),
		dateTimePart(parts, "month"),
		dateTimePart(parts, "day"),
		"T",
		dateTimePart(parts, "hour"),
		dateTimePart(parts, "minute"),
		dateTimePart(parts, "second"),
		"Z",
	].join("");
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

export function createIcsContent(event: CalendarEventData) {
	const description = calendarDescription(event);
	const { error, value } = createEvent({
		description: description || undefined,
		end: validDate(event.endsAt).getTime(),
		endInputType: "utc",
		endOutputType: "utc",
		location: event.location || undefined,
		method: "PUBLISH",
		productId: "-//SacTech//Community Events//EN",
		start: validDate(event.startsAt).getTime(),
		startInputType: "utc",
		startOutputType: "utc",
		status: "CONFIRMED",
		title: event.title,
		uid: `${event.id}@sac-tech.org`,
		url: event.url,
	});

	if (error || value === null) {
		throw new Error("Unable to create ICS calendar content.", {
			cause: error ?? undefined,
		});
	}

	return value;
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
