import type { RecurrenceRule } from "@/app/events/types";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localDateTimeFormatter = new Intl.DateTimeFormat("en-US-u-ca-gregory", {
	day: "2-digit",
	hour: "2-digit",
	hourCycle: "h23",
	minute: "2-digit",
	month: "2-digit",
	second: "2-digit",
	timeZone: SACRAMENTO_TIME_ZONE,
	year: "numeric",
});

interface LocalDate {
	day: number;
	month: number;
	year: number;
}

interface LocalDateTime extends LocalDate {
	hour: number;
	millisecond: number;
	minute: number;
	second: number;
}

type DateBoundary = Date | string;

function calendarDate({ day, month, year }: LocalDate) {
	const date = new Date(0);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCFullYear(year, month - 1, day);
	return date;
}

function localDateFromCalendarDate(date: Date): LocalDate {
	return {
		day: date.getUTCDate(),
		month: date.getUTCMonth() + 1,
		year: date.getUTCFullYear(),
	};
}

function compareLocalDates(left: LocalDate, right: LocalDate) {
	return calendarDate(left).valueOf() - calendarDate(right).valueOf();
}

function addDays(date: LocalDate, amount: number) {
	return localDateFromCalendarDate(
		new Date(calendarDate(date).valueOf() + amount * MILLISECONDS_PER_DAY),
	);
}

function addMonths(date: LocalDate, amount: number): LocalDate {
	const monthIndex = date.year * 12 + date.month - 1 + amount;
	const year = Math.floor(monthIndex / 12);

	return {
		day: date.day,
		month: monthIndex - year * 12 + 1,
		year,
	};
}

function daysBetween(left: LocalDate, right: LocalDate) {
	return Math.floor(
		(calendarDate(right).valueOf() - calendarDate(left).valueOf()) /
			MILLISECONDS_PER_DAY,
	);
}

function monthsBetween(left: LocalDate, right: LocalDate) {
	return (right.year - left.year) * 12 + right.month - left.month;
}

function daysInMonth(year: number, month: number) {
	const date = new Date(0);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCFullYear(year, month, 0);
	return date.getUTCDate();
}

function weekday(date: LocalDate) {
	return calendarDate(date).getUTCDay();
}

function formatDateKey(date: LocalDate) {
	return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function parseDateKey(value: string, label: string): LocalDate {
	const match = dateKeyPattern.exec(value);

	if (!match) {
		throw new TypeError(`${label} must use YYYY-MM-DD format.`);
	}

	const date = {
		day: Number(match[3]),
		month: Number(match[2]),
		year: Number(match[1]),
	};

	if (
		date.year < 1 ||
		formatDateKey(localDateFromCalendarDate(calendarDate(date))) !== value
	) {
		throw new TypeError(`${label} must be a valid calendar date.`);
	}

	return date;
}

function getDateTimePart(parts: Intl.DateTimeFormatPart[], type: string) {
	const value = parts.find((part) => part.type === type)?.value;

	if (value === undefined) {
		throw new Error(`Could not determine the ${type} in Sacramento time.`);
	}

	return Number(value);
}

function toLocalDateTime(date: Date): LocalDateTime {
	if (Number.isNaN(date.valueOf())) {
		throw new TypeError("The recurrence start must be a valid Date.");
	}

	const parts = localDateTimeFormatter.formatToParts(date);

	return {
		day: getDateTimePart(parts, "day"),
		hour: getDateTimePart(parts, "hour"),
		millisecond: date.getUTCMilliseconds(),
		minute: getDateTimePart(parts, "minute"),
		month: getDateTimePart(parts, "month"),
		second: getDateTimePart(parts, "second"),
		year: getDateTimePart(parts, "year"),
	};
}

function toLocalDate(date: Date) {
	const { day, month, year } = toLocalDateTime(date);
	return { day, month, year };
}

function parseBoundary(value: DateBoundary, label: string) {
	return typeof value === "string"
		? parseDateKey(value, label)
		: toLocalDate(value);
}

function getTimeZoneOffset(date: Date) {
	const local = toLocalDateTime(date);
	const localAsUtc = Date.UTC(
		local.year,
		local.month - 1,
		local.day,
		local.hour,
		local.minute,
		local.second,
	);
	const instantWithoutMilliseconds = Math.floor(date.valueOf() / 1_000) * 1_000;

	return localAsUtc - instantWithoutMilliseconds;
}

function localDateTimeToDate(local: LocalDateTime) {
	const wallClockAsUtc = Date.UTC(
		local.year,
		local.month - 1,
		local.day,
		local.hour,
		local.minute,
		local.second,
		local.millisecond,
	);
	let instant = wallClockAsUtc - getTimeZoneOffset(new Date(wallClockAsUtc));

	for (let index = 0; index < 3; index += 1) {
		const adjusted = wallClockAsUtc - getTimeZoneOffset(new Date(instant));

		if (adjusted === instant) {
			break;
		}

		instant = adjusted;
	}

	const result = new Date(instant);
	const roundTrip = toLocalDateTime(result);
	const isSameWallClock =
		roundTrip.year === local.year &&
		roundTrip.month === local.month &&
		roundTrip.day === local.day &&
		roundTrip.hour === local.hour &&
		roundTrip.minute === local.minute &&
		roundTrip.second === local.second &&
		roundTrip.millisecond === local.millisecond;

	return isSameWallClock ? result : null;
}

function localDateTimeAsUtc(local: LocalDateTime) {
	return Date.UTC(
		local.year,
		local.month - 1,
		local.day,
		local.hour,
		local.minute,
		local.second,
		local.millisecond,
	);
}

function localDateTimeFromUtc(value: number): LocalDateTime {
	const date = new Date(value);

	return {
		day: date.getUTCDate(),
		hour: date.getUTCHours(),
		millisecond: date.getUTCMilliseconds(),
		minute: date.getUTCMinutes(),
		month: date.getUTCMonth() + 1,
		second: date.getUTCSeconds(),
		year: date.getUTCFullYear(),
	};
}

function resolveSpringForwardGap(local: LocalDateTime) {
	const wallClockAsUtc = localDateTimeAsUtc(local);
	const offsets = new Set(
		[-36, -12, 12, 36].map((hours) =>
			getTimeZoneOffset(new Date(wallClockAsUtc + hours * 60 * 60 * 1_000)),
		),
	);
	let closestLaterCandidate: {
		date: Date;
		wallClockDifference: number;
	} | null = null;

	for (const offset of offsets) {
		const candidate = new Date(wallClockAsUtc - offset);
		const candidateWallClock = localDateTimeAsUtc(toLocalDateTime(candidate));
		const wallClockDifference = candidateWallClock - wallClockAsUtc;

		if (
			wallClockDifference > 0 &&
			(!closestLaterCandidate ||
				wallClockDifference < closestLaterCandidate.wallClockDifference)
		) {
			closestLaterCandidate = { date: candidate, wallClockDifference };
		}
	}

	return closestLaterCandidate?.date ?? null;
}

function validateRule(rule: RecurrenceRule) {
	if (!Number.isInteger(rule.interval) || rule.interval < 1) {
		throw new RangeError("Recurrence interval must be a positive integer.");
	}

	if (
		rule.weekdays?.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
	) {
		throw new RangeError("Recurrence weekdays must be integers from 0 to 6.");
	}

	if (rule.endType === "on_date" && !rule.endDate) {
		throw new TypeError("An on-date recurrence must include an end date.");
	}

	if (
		rule.endType === "after_occurrences" &&
		(!Number.isInteger(rule.occurrenceCount) || (rule.occurrenceCount ?? 0) < 1)
	) {
		throw new RangeError(
			"An after-occurrences recurrence must include a positive count.",
		);
	}

	for (const excludedDate of rule.excludedDates) {
		parseDateKey(excludedDate, "Excluded occurrence date");
	}
}

function getNthWeekdayDate(
	year: number,
	month: number,
	targetWeekday: number,
	ordinal: number,
) {
	const firstWeekday = weekday({ day: 1, month, year });
	const day = 1 + ((targetWeekday - firstWeekday + 7) % 7) + (ordinal - 1) * 7;

	return day <= daysInMonth(year, month) ? { day, month, year } : null;
}

function initialPeriodIndex(
	start: LocalDate,
	minimum: LocalDate,
	rule: RecurrenceRule,
) {
	if (rule.endType === "after_occurrences") {
		return 0;
	}

	switch (rule.frequency) {
		case "day":
			return Math.max(
				0,
				Math.floor(daysBetween(start, minimum) / rule.interval),
			);
		case "week": {
			const startOfFirstWeek = addDays(start, -weekday(start));
			return Math.max(
				0,
				Math.floor(
					daysBetween(startOfFirstWeek, minimum) / (7 * rule.interval),
				),
			);
		}
		case "month":
			return Math.max(
				0,
				Math.floor(monthsBetween(start, minimum) / rule.interval),
			);
		case "year":
			return Math.max(
				0,
				Math.floor((minimum.year - start.year) / rule.interval),
			);
	}
}

function enumerateOccurrences(
	startsAt: Date,
	rule: RecurrenceRule,
	minimumDate: LocalDate,
	maximumDate: LocalDate | null,
	visit: (occurrence: Date) => boolean,
) {
	validateRule(rule);

	const startDateTime = toLocalDateTime(startsAt);
	const startDate: LocalDate = {
		day: startDateTime.day,
		month: startDateTime.month,
		year: startDateTime.year,
	};
	const ruleEndDate =
		rule.endType === "on_date"
			? parseDateKey(rule.endDate as string, "Recurrence end date")
			: null;
	const lastDate =
		ruleEndDate && maximumDate
			? compareLocalDates(ruleEndDate, maximumDate) < 0
				? ruleEndDate
				: maximumDate
			: (ruleEndDate ?? maximumDate);
	const maximumOccurrences =
		rule.endType === "after_occurrences"
			? (rule.occurrenceCount as number)
			: Number.POSITIVE_INFINITY;
	let occurrenceNumber = 0;
	let shouldStop = false;
	const excludedDates = new Set(rule.excludedDates);

	const considerDate = (date: LocalDate) => {
		if (compareLocalDates(date, startDate) < 0) {
			return;
		}

		if (lastDate && compareLocalDates(date, lastDate) > 0) {
			shouldStop = true;
			return;
		}

		const occurrence = localDateTimeToDate({ ...startDateTime, ...date });

		if (!occurrence) {
			return;
		}

		occurrenceNumber += 1;

		if (occurrenceNumber > maximumOccurrences) {
			shouldStop = true;
			return;
		}

		// An exception removes a scheduled date from display without changing its
		// position in an occurrence-count-limited series.
		if (excludedDates.has(formatDateKey(date))) {
			return;
		}

		if (compareLocalDates(date, minimumDate) >= 0 && visit(occurrence)) {
			shouldStop = true;
		}
	};

	let periodIndex = initialPeriodIndex(startDate, minimumDate, rule);

	while (!shouldStop) {
		switch (rule.frequency) {
			case "day": {
				considerDate(addDays(startDate, periodIndex * rule.interval));
				break;
			}
			case "week": {
				const startWeekday = weekday(startDate);
				const firstWeek = addDays(startDate, -startWeekday);
				const weekStart = addDays(firstWeek, periodIndex * rule.interval * 7);
				const selectedWeekdays = [
					...new Set([...(rule.weekdays ?? []), startWeekday]),
				].sort((left, right) => left - right);

				for (const selectedWeekday of selectedWeekdays) {
					considerDate(addDays(weekStart, selectedWeekday));

					if (shouldStop) {
						break;
					}
				}
				break;
			}
			case "month": {
				const month = addMonths(startDate, periodIndex * rule.interval);
				const pattern = rule.monthlyPattern ?? "day_of_month";
				const date =
					pattern === "nth_weekday"
						? getNthWeekdayDate(
								month.year,
								month.month,
								weekday(startDate),
								Math.ceil(startDate.day / 7),
							)
						: startDate.day <= daysInMonth(month.year, month.month)
							? { ...month, day: startDate.day }
							: null;

				if (date) {
					considerDate(date);
				}
				break;
			}
			case "year": {
				const year = startDate.year + periodIndex * rule.interval;
				const date =
					startDate.day <= daysInMonth(year, startDate.month)
						? { ...startDate, year }
						: null;

				if (date) {
					considerDate(date);
				}
				break;
			}
		}

		periodIndex += 1;
	}
}

/** Formats an instant as its Sacramento-local calendar date. */
export function getSacramentoDateKey(date: Date): string {
	return formatDateKey(toLocalDate(date));
}

/**
 * Expands a recurrence into Sacramento-local calendar dates, inclusive of both
 * range boundaries. A Date boundary is interpreted in Sacramento time.
 */
export function getOccurrencesInRange(
	startsAt: Date,
	rule: RecurrenceRule,
	rangeStart: DateBoundary,
	rangeEnd: DateBoundary,
): Date[] {
	const minimumDate = parseBoundary(rangeStart, "Range start");
	const maximumDate = parseBoundary(rangeEnd, "Range end");

	if (compareLocalDates(minimumDate, maximumDate) > 0) {
		throw new RangeError("Recurrence range end must not precede its start.");
	}

	const occurrences: Date[] = [];

	enumerateOccurrences(
		startsAt,
		rule,
		minimumDate,
		maximumDate,
		(occurrence) => {
			occurrences.push(occurrence);
			return false;
		},
	);

	return occurrences;
}

/** Returns the first occurrence on or after the Sacramento-local reference date. */
export function getNextOccurrence(
	startsAt: Date,
	rule: RecurrenceRule,
	referenceDate: DateBoundary,
): Date | null {
	const minimumDate = parseBoundary(referenceDate, "Reference date");
	let nextOccurrence: Date | null = null;

	enumerateOccurrences(startsAt, rule, minimumDate, null, (occurrence) => {
		nextOccurrence = occurrence;
		return true;
	});

	return nextOccurrence;
}

/** Returns the first not-yet-started occurrence after an instant. */
export function getNextFutureOccurrence(
	startsAt: Date,
	rule: RecurrenceRule,
	referenceInstant: Date,
): Date | null {
	const referenceDate = toLocalDate(referenceInstant);
	const candidate = getNextOccurrence(
		startsAt,
		rule,
		formatDateKey(referenceDate),
	);

	if (!candidate || candidate > referenceInstant) {
		return candidate;
	}

	return getNextOccurrence(
		startsAt,
		rule,
		formatDateKey(addDays(referenceDate, 1)),
	);
}

/**
 * Reapplies the seed event's Sacramento-local calendar and wall-clock duration
 * to an expanded occurrence. If the mapped end falls in the spring-forward
 * gap, it is shifted forward by that gap, matching compatible timezone
 * disambiguation.
 */
export function getOccurrenceEnd(
	seedStartsAt: Date,
	seedEndsAt: Date,
	occurrenceStartsAt: Date,
): Date {
	if (
		Number.isNaN(seedStartsAt.valueOf()) ||
		Number.isNaN(seedEndsAt.valueOf()) ||
		Number.isNaN(occurrenceStartsAt.valueOf())
	) {
		throw new TypeError("Occurrence boundaries must be valid Dates.");
	}

	const elapsedDuration = seedEndsAt.valueOf() - seedStartsAt.valueOf();

	if (elapsedDuration <= 0) {
		throw new RangeError("The seed event end must be after its start.");
	}

	const seedStartWallClock = localDateTimeAsUtc(toLocalDateTime(seedStartsAt));
	const seedEndWallClock = localDateTimeAsUtc(toLocalDateTime(seedEndsAt));
	const occurrenceStartWallClock = localDateTimeAsUtc(
		toLocalDateTime(occurrenceStartsAt),
	);
	const mappedEndWallClock =
		occurrenceStartWallClock + seedEndWallClock - seedStartWallClock;
	const mappedEndLocal = localDateTimeFromUtc(mappedEndWallClock);
	const mappedEnd =
		localDateTimeToDate(mappedEndLocal) ??
		resolveSpringForwardGap(mappedEndLocal);

	if (mappedEnd && mappedEnd.valueOf() > occurrenceStartsAt.valueOf()) {
		return mappedEnd;
	}

	return new Date(occurrenceStartsAt.valueOf() + elapsedDuration);
}
