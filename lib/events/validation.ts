import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { z } from "zod";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import type { EventFormField } from "@/lib/events/state";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const optionalTrimmedString = (maxLength: number) =>
	z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? undefined : value,
		z.string().trim().max(maxLength).optional(),
	);

const optionalWebUrl = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() === "" ? undefined : value,
	z
		.url("Enter a valid web address.")
		.max(2_048, "The web address is too long.")
		.refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
			message: "Use an http:// or https:// web address.",
		})
		.optional(),
);

const localDateTime = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.");

const recurrenceInterval = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() !== "" ? Number(value) : value,
	z
		.number({ error: "Enter how often the event repeats." })
		.int("Use a whole number.")
		.min(1, "Repeat at least every 1 unit.")
		.max(99, "Repeat no more than every 99 units."),
);

const optionalOccurrenceCount = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() !== ""
			? Number(value)
			: undefined,
	z
		.number({ error: "Enter the number of occurrences." })
		.int("Use a whole number of occurrences.")
		.min(2, "Use at least 2 occurrences.")
		.max(1_000, "Use no more than 1,000 occurrences.")
		.optional(),
);

const optionalLocalDate = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() !== "" ? value.trim() : undefined,
	z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an ending date.")
		.optional(),
);

const recurrenceSchema = z
	.object({
		frequency: z.enum(["day", "week", "month", "year"], {
			error: "Choose how often the event repeats.",
		}),
		interval: recurrenceInterval,
		weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
		monthlyPattern: z.preprocess(
			(value) =>
				typeof value === "string" && value.trim() === "" ? undefined : value,
			z
				.enum(["day_of_month", "nth_weekday"], {
					error: "Choose the monthly pattern.",
				})
				.optional(),
		),
		endType: z.enum(["never", "on_date", "after_occurrences"], {
			error: "Choose when the recurrence ends.",
		}),
		endDate: optionalLocalDate,
		occurrenceCount: optionalOccurrenceCount,
	})
	.superRefine((value, context) => {
		if (value.frequency === "week" && value.weekdays.length === 0) {
			context.addIssue({
				code: "custom",
				message: "Choose at least one weekday.",
				path: ["weekdays"],
			});
		}

		if (value.frequency === "month" && !value.monthlyPattern) {
			context.addIssue({
				code: "custom",
				message: "Choose how the monthly event repeats.",
				path: ["monthlyPattern"],
			});
		}

		if (value.endType === "on_date" && !value.endDate) {
			context.addIssue({
				code: "custom",
				message: "Choose the final recurrence date.",
				path: ["endDate"],
			});
		}

		if (value.endType === "after_occurrences" && !value.occurrenceCount) {
			context.addIssue({
				code: "custom",
				message: "Enter how many occurrences to create.",
				path: ["occurrenceCount"],
			});
		}
	});

const submissionSchema = z
	.object({
		title: z.string().trim().min(3, "Use at least 3 characters.").max(160),
		description: z
			.string()
			.trim()
			.min(20, "Share at least 20 characters about the event.")
			.max(4_000, "Keep the description under 4,000 characters."),
		startsAt: localDateTime,
		endsAt: localDateTime,
		mode: z.enum(["online", "in_person", "hybrid"], {
			error: "Choose how people will attend.",
		}),
		locationName: optionalTrimmedString(200),
		locationAddress: optionalTrimmedString(500),
		eventUrl: optionalWebUrl,
	})
	.superRefine((value, context) => {
		if (value.mode !== "online" && !value.locationName) {
			context.addIssue({
				code: "custom",
				message: "Add the venue or location name.",
				path: ["locationName"],
			});
		}

		if (value.mode !== "in_person" && !value.eventUrl) {
			context.addIssue({
				code: "custom",
				message: "Add the online event or registration link.",
				path: ["eventUrl"],
			});
		}
	});

export interface ValidatedEventSubmission {
	title: string;
	description: string;
	startsAt: Date;
	endsAt: Date;
	mode: "online" | "in_person" | "hybrid";
	locationName?: string;
	locationAddress?: string;
	eventUrl?: string;
	recurrence: ValidatedRecurrence | null;
}

export interface ValidatedRecurrence {
	frequency: "day" | "week" | "month" | "year";
	interval: number;
	weekdays: number[] | null;
	monthlyPattern: "day_of_month" | "nth_weekday" | null;
	endType: "never" | "on_date" | "after_occurrences";
	endDate: string | null;
	occurrenceCount: number | null;
}

interface SubmissionValidationResult {
	data?: ValidatedEventSubmission;
	errors?: Partial<Record<EventFormField, string[]>>;
}

interface EventSubmissionValidationOptions {
	allowRecurrence?: boolean;
	/** Allow an established series to retain this exact historical seed time. */
	permittedPastStart?: Date;
}

function addFieldError(
	errors: Partial<Record<EventFormField, string[]>>,
	field: EventFormField,
	message: string,
) {
	errors[field] = [...(errors[field] ?? []), message];
}

function parseSacramentoDateTime(value: string) {
	const parsed = dayjs.tz(value, "YYYY-MM-DDTHH:mm", SACRAMENTO_TIME_ZONE);

	if (!parsed.isValid() || parsed.format("YYYY-MM-DDTHH:mm") !== value) {
		return null;
	}

	return parsed.toDate();
}

export function validateEventSubmission(
	formData: FormData,
	options: EventSubmissionValidationOptions = {},
): SubmissionValidationResult {
	const parsedSubmission = submissionSchema.safeParse({
		title: formData.get("title"),
		description: formData.get("description"),
		startsAt: formData.get("startsAt"),
		endsAt: formData.get("endsAt"),
		mode: formData.get("mode"),
		locationName: formData.get("locationName"),
		locationAddress: formData.get("locationAddress"),
		eventUrl: formData.get("eventUrl"),
	});
	const allowRecurrence = options.allowRecurrence ?? true;
	const recurrenceWasSubmitted = formData.get("recurring") === "on";
	const isRecurring = allowRecurrence && recurrenceWasSubmitted;
	const parsedRecurrence = isRecurring
		? recurrenceSchema.safeParse({
				frequency: formData.get("recurrenceFrequency"),
				interval: formData.get("recurrenceInterval"),
				weekdays: formData.getAll("recurrenceWeekdays"),
				monthlyPattern: formData.get("recurrenceMonthlyPattern") ?? undefined,
				endType: formData.get("recurrenceEndType"),
				endDate: formData.get("recurrenceEndDate"),
				occurrenceCount: formData.get("recurrenceCount"),
			})
		: null;
	const errors: Partial<Record<EventFormField, string[]>> = {};

	if (!allowRecurrence && recurrenceWasSubmitted) {
		addFieldError(
			errors,
			"recurring",
			"Recurrence can only be changed for the whole series.",
		);
	}

	if (!parsedSubmission.success) {
		for (const issue of parsedSubmission.error.issues) {
			const field = issue.path[0];
			if (typeof field === "string") {
				addFieldError(errors, field as EventFormField, issue.message);
			}
		}
	}

	if (parsedRecurrence && !parsedRecurrence.success) {
		const recurrenceFieldMap = {
			endDate: "recurrenceEndDate",
			endType: "recurrenceEndType",
			frequency: "recurrenceFrequency",
			interval: "recurrenceInterval",
			monthlyPattern: "recurrenceMonthlyPattern",
			occurrenceCount: "recurrenceCount",
			weekdays: "recurrenceWeekdays",
		} as const;

		for (const issue of parsedRecurrence.error.issues) {
			const field = issue.path[0];
			if (typeof field === "string" && field in recurrenceFieldMap) {
				addFieldError(
					errors,
					recurrenceFieldMap[field as keyof typeof recurrenceFieldMap],
					issue.message,
				);
			}
		}
	}

	if (
		!parsedSubmission.success ||
		(parsedRecurrence && !parsedRecurrence.success)
	) {
		return { errors };
	}

	const startsAt = parseSacramentoDateTime(parsedSubmission.data.startsAt);
	const endsAt = parseSacramentoDateTime(parsedSubmission.data.endsAt);

	if (!startsAt) {
		addFieldError(errors, "startsAt", "Choose a valid Pacific time.");
	}

	if (!endsAt) {
		addFieldError(errors, "endsAt", "Choose a valid Pacific time.");
	}

	const retainsPermittedPastStart =
		startsAt &&
		options.permittedPastStart &&
		Math.floor(startsAt.getTime() / 60_000) ===
			Math.floor(options.permittedPastStart.getTime() / 60_000);

	if (
		startsAt &&
		!retainsPermittedPastStart &&
		startsAt.getTime() < Date.now() - 15 * 60 * 1_000
	) {
		addFieldError(errors, "startsAt", "The event must start in the future.");
	}

	if (startsAt && endsAt && endsAt <= startsAt) {
		addFieldError(errors, "endsAt", "The end must be after the start.");
	}

	if (
		startsAt &&
		endsAt &&
		endsAt.getTime() - startsAt.getTime() > 14 * 24 * 60 * 60 * 1_000
	) {
		addFieldError(errors, "endsAt", "Events cannot span more than 14 days.");
	}

	if (startsAt && parsedRecurrence?.success) {
		const startDate = dayjs(startsAt)
			.tz(SACRAMENTO_TIME_ZONE)
			.format("YYYY-MM-DD");
		const startWeekday = dayjs(startsAt).tz(SACRAMENTO_TIME_ZONE).day();

		if (
			parsedRecurrence.data.frequency === "week" &&
			!parsedRecurrence.data.weekdays.includes(startWeekday)
		) {
			addFieldError(
				errors,
				"recurrenceWeekdays",
				"Include the weekday of the first event.",
			);
		}

		if (parsedRecurrence.data.endType === "on_date") {
			const endDate = parsedRecurrence.data.endDate;
			const parsedEndDate = endDate ? dayjs(endDate, "YYYY-MM-DD", true) : null;

			if (
				!endDate ||
				!parsedEndDate?.isValid() ||
				parsedEndDate.format("YYYY-MM-DD") !== endDate
			) {
				addFieldError(
					errors,
					"recurrenceEndDate",
					"Choose a valid ending date.",
				);
			} else if (endDate < startDate) {
				addFieldError(
					errors,
					"recurrenceEndDate",
					"The recurrence cannot end before the first event.",
				);
			}
		}
	}

	if (Object.keys(errors).length > 0 || !startsAt || !endsAt) {
		return { errors };
	}

	return {
		data: {
			...parsedSubmission.data,
			startsAt,
			endsAt,
			recurrence: parsedRecurrence?.success
				? {
						frequency: parsedRecurrence.data.frequency,
						interval: parsedRecurrence.data.interval,
						weekdays:
							parsedRecurrence.data.frequency === "week"
								? [...new Set(parsedRecurrence.data.weekdays)].sort(
										(left, right) => left - right,
									)
								: null,
						monthlyPattern:
							parsedRecurrence.data.frequency === "month"
								? (parsedRecurrence.data.monthlyPattern ?? null)
								: null,
						endType: parsedRecurrence.data.endType,
						endDate:
							parsedRecurrence.data.endType === "on_date"
								? (parsedRecurrence.data.endDate ?? null)
								: null,
						occurrenceCount:
							parsedRecurrence.data.endType === "after_occurrences"
								? (parsedRecurrence.data.occurrenceCount ?? null)
								: null,
					}
				: null,
		},
	};
}

const moderationSchema = z
	.object({
		decision: z.enum(["approved", "rejected"]),
		note: optionalTrimmedString(500),
	})
	.superRefine((value, context) => {
		if (
			value.decision === "rejected" &&
			(!value.note || value.note.length < 5)
		) {
			context.addIssue({
				code: "custom",
				message: "Add a short note so the submitter knows what to change.",
				path: ["note"],
			});
		}
	});

export function validateModeration(formData: FormData) {
	return moderationSchema.safeParse({
		decision: formData.get("decision"),
		note: formData.get("note"),
	});
}
