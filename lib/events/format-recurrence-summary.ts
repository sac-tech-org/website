import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";

const weekdays = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

const startDateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "long",
	timeZone: SACRAMENTO_TIME_ZONE,
	weekday: "long",
});

const endDateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeZone: "UTC",
});

const weekdayListFormatter = new Intl.ListFormat("en-US", {
	style: "long",
	type: "conjunction",
});

export interface RecurrenceSummaryInput {
	readonly startsAt: Date;
	readonly recurrenceFrequency: "day" | "week" | "month" | "year" | null;
	readonly recurrenceInterval: number | null;
	readonly recurrenceWeekdays: readonly number[] | null;
	readonly recurrenceMonthlyPattern: "day_of_month" | "nth_weekday" | null;
	readonly recurrenceEndType:
		| "never"
		| "on_date"
		| "after_occurrences"
		| null;
	readonly recurrenceEndDate: string | null;
	readonly recurrenceCount: number | null;
}

function ordinal(value: number) {
	const remainder = value % 100;

	if (remainder >= 11 && remainder <= 13) {
		return `${value}th`;
	}

	switch (value % 10) {
		case 1:
			return `${value}st`;
		case 2:
			return `${value}nd`;
		case 3:
			return `${value}rd`;
		default:
			return `${value}th`;
	}
}

export function formatRecurrenceSummary(rule: RecurrenceSummaryInput) {
	if (!rule.recurrenceFrequency) {
		return "Does not repeat";
	}

	const interval = rule.recurrenceInterval ?? 1;
	const startParts = startDateFormatter.formatToParts(rule.startsAt);
	const startDay = Number(
		startParts.find((part) => part.type === "day")?.value ?? "1",
	);
	const startMonth =
		startParts.find((part) => part.type === "month")?.value ?? "";
	const startWeekday =
		startParts.find((part) => part.type === "weekday")?.value ?? "";
	const unit = rule.recurrenceFrequency;
	let summary =
		interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

	if (unit === "week" && rule.recurrenceWeekdays?.length) {
		const dayNames = rule.recurrenceWeekdays
			.map((day) => weekdays[day])
			.filter((day): day is (typeof weekdays)[number] => Boolean(day));

		if (dayNames.length) {
			summary += ` on ${weekdayListFormatter.format(dayNames)}`;
		}
	}

	if (unit === "month") {
		summary +=
			rule.recurrenceMonthlyPattern === "nth_weekday"
				? ` on the ${ordinal(Math.ceil(startDay / 7))} ${startWeekday}`
				: ` on day ${startDay}`;
	}

	if (unit === "year") {
		summary += ` on ${startMonth} ${startDay}`;
	}

	if (rule.recurrenceEndType === "on_date" && rule.recurrenceEndDate) {
		const endDate = new Date(`${rule.recurrenceEndDate}T12:00:00Z`);
		summary += ` through ${endDateFormatter.format(endDate)}`;
	} else if (
		rule.recurrenceEndType === "after_occurrences" &&
		rule.recurrenceCount
	) {
		summary += ` for ${rule.recurrenceCount} occurrences`;
	} else {
		summary += " with no set end";
	}

	return summary;
}
