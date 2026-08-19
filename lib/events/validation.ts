import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { z } from "zod";
import type { EventFormField } from "@/lib/events/state";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export const SACRAMENTO_TIMEZONE = "America/Los_Angeles";

const optionalTrimmedString = (maxLength: number) =>
	z.preprocess(
		(value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
		z.string().trim().max(maxLength).optional(),
	);

const optionalWebUrl = z.preprocess(
	(value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
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
}

interface SubmissionValidationResult {
	data?: ValidatedEventSubmission;
	errors?: Partial<Record<EventFormField, string[]>>;
}

function addFieldError(
	errors: Partial<Record<EventFormField, string[]>>,
	field: EventFormField,
	message: string,
) {
	errors[field] = [...(errors[field] ?? []), message];
}

function parseSacramentoDateTime(value: string) {
	const parsed = dayjs.tz(value, "YYYY-MM-DDTHH:mm", SACRAMENTO_TIMEZONE);

	if (!parsed.isValid() || parsed.format("YYYY-MM-DDTHH:mm") !== value) {
		return null;
	}

	return parsed.toDate();
}

export function validateEventSubmission(
	formData: FormData,
): SubmissionValidationResult {
	const parsed = submissionSchema.safeParse({
		title: formData.get("title"),
		description: formData.get("description"),
		startsAt: formData.get("startsAt"),
		endsAt: formData.get("endsAt"),
		mode: formData.get("mode"),
		locationName: formData.get("locationName"),
		locationAddress: formData.get("locationAddress"),
		eventUrl: formData.get("eventUrl"),
	});

	if (!parsed.success) {
		const errors: Partial<Record<EventFormField, string[]>> = {};

		for (const issue of parsed.error.issues) {
			const field = issue.path[0];
			if (typeof field === "string") {
				addFieldError(errors, field as EventFormField, issue.message);
			}
		}

		return { errors };
	}

	const startsAt = parseSacramentoDateTime(parsed.data.startsAt);
	const endsAt = parseSacramentoDateTime(parsed.data.endsAt);
	const errors: Partial<Record<EventFormField, string[]>> = {};

	if (!startsAt) {
		addFieldError(errors, "startsAt", "Choose a valid Pacific time.");
	}

	if (!endsAt) {
		addFieldError(errors, "endsAt", "Choose a valid Pacific time.");
	}

	if (startsAt && startsAt.getTime() < Date.now() - 15 * 60 * 1_000) {
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

	if (Object.keys(errors).length > 0 || !startsAt || !endsAt) {
		return { errors };
	}

	return {
		data: {
			...parsed.data,
			startsAt,
			endsAt,
		},
	};
}

const moderationSchema = z
	.object({
		decision: z.enum(["approved", "rejected"]),
		note: optionalTrimmedString(500),
	})
	.superRefine((value, context) => {
		if (value.decision === "rejected" && (!value.note || value.note.length < 5)) {
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
