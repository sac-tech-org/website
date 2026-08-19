"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
	event,
	eventOccurrenceCancellation,
	eventRecurrence,
} from "@/db/schema";
import type { RecurrenceRule } from "@/app/events/types";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import { getCurrentSession, sessionIsAdmin } from "@/lib/session";
import type {
	CancellationFormState,
	EventFormState,
	ModerationFormState,
} from "@/lib/events/state";
import {
	getOccurrencesInRange,
	getSacramentoDateKey,
} from "@/lib/events/recurrence";
import {
	validateEventSubmission,
	validateModeration,
} from "@/lib/events/validation";

const cancellationSchema = z.discriminatedUnion("scope", [
	z.object({
		occurrenceDate: z.unknown().optional(),
		scope: z.literal("event"),
	}),
	z.object({
		occurrenceDate: z.iso.date("Choose a valid occurrence date."),
		scope: z.literal("occurrence"),
	}),
]);

export async function submitEvent(
	_previousState: EventFormState,
	formData: FormData,
): Promise<EventFormState> {
	const session = await getCurrentSession();

	if (!session) {
		return {
			status: "error",
			message: "Your session expired. Sign in again before submitting.",
		};
	}

	const validation = validateEventSubmission(formData);

	if (!validation.data) {
		return {
			status: "error",
			message: "Check the highlighted fields and try again.",
			errors: validation.errors,
		};
	}

	try {
		const { recurrence, ...eventValues } = validation.data;

		await db.transaction(async (transaction) => {
			const [createdEvent] = await transaction
				.insert(event)
				.values({
					...eventValues,
					status: "pending",
					submittedBy: session.user.id,
					timezone: SACRAMENTO_TIME_ZONE,
				})
				.returning({ id: event.id });

			if (!createdEvent) {
				throw new Error("The event insert did not return an id.");
			}

			if (recurrence) {
				await transaction.insert(eventRecurrence).values({
					...recurrence,
					eventId: createdEvent.id,
				});
			}
		});
	} catch (error) {
		console.error("Unable to save event submission", error);
		return {
			status: "error",
			message: "We could not save the event right now. Please try again.",
		};
	}

	revalidatePath("/account");
	revalidatePath("/admin/events");

	return {
		status: "success",
		message:
			"Event submitted. A SacTech admin will review it before it appears.",
	};
}

export async function moderateEvent(
	eventId: string,
	_previousState: ModerationFormState,
	formData: FormData,
): Promise<ModerationFormState> {
	const session = await getCurrentSession();

	if (!session || !sessionIsAdmin(session)) {
		return {
			status: "error",
			message: "You do not have permission to review events.",
		};
	}

	const id = z.uuid().safeParse(eventId);
	const moderation = validateModeration(formData);

	if (!id.success || !moderation.success) {
		return {
			status: "error",
			message: moderation.success
				? "That event could not be found."
				: (moderation.error.issues[0]?.message ??
					"Check the review and try again."),
		};
	}

	try {
		const [updatedEvent] = await db
			.update(event)
			.set({
				moderationNote: moderation.data.note ?? null,
				reviewedAt: new Date(),
				reviewedBy: session.user.id,
				status: moderation.data.decision,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(event.id, id.data),
					eq(event.status, "pending"),
					isNull(event.canceledAt),
				),
			)
			.returning({ id: event.id });

		if (!updatedEvent) {
			return {
				status: "error",
				message: "This event has already been reviewed or canceled.",
			};
		}
	} catch (error) {
		console.error("Unable to moderate event", error);
		return {
			status: "error",
			message: "We could not save this review. Please try again.",
		};
	}

	revalidatePath("/events");
	revalidatePath("/account");
	revalidatePath("/admin/events");

	return {
		status: "success",
		message:
			moderation.data.decision === "approved"
				? "Event approved and published."
				: "Event rejected. The submitter can now see your note.",
	};
}

export async function cancelEvent(
	eventId: string,
	_previousState: CancellationFormState,
	formData: FormData,
): Promise<CancellationFormState> {
	const session = await getCurrentSession();

	if (!session) {
		return {
			status: "error",
			message: "Your session expired. Sign in again before canceling.",
		};
	}

	const id = z.uuid().safeParse(eventId);
	const cancellation = cancellationSchema.safeParse({
		occurrenceDate: formData.get("occurrenceDate") ?? undefined,
		scope: formData.get("scope"),
	});

	if (!id.success) {
		return {
			status: "error",
			message: "That event could not be found.",
		};
	}

	if (!cancellation.success) {
		return {
			status: "error",
			message:
				cancellation.error.issues[0]?.message ??
				"Choose what you want to cancel.",
		};
	}

	try {
		const result = await db.transaction(async (transaction) => {
			const [ownedEvent] = await transaction
				.select({
					canceledAt: event.canceledAt,
					recurrenceCount: eventRecurrence.occurrenceCount,
					recurrenceEndDate: eventRecurrence.endDate,
					recurrenceEndType: eventRecurrence.endType,
					recurrenceFrequency: eventRecurrence.frequency,
					recurrenceInterval: eventRecurrence.interval,
					recurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
					recurrenceWeekdays: eventRecurrence.weekdays,
					startsAt: event.startsAt,
				})
				.from(event)
				.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
				.where(
					and(eq(event.id, id.data), eq(event.submittedBy, session.user.id)),
				)
				.limit(1)
				.for("update", { of: event });

			if (!ownedEvent) {
				return {
					status: "error",
					message: "That event could not be found in your submissions.",
				} satisfies CancellationFormState;
			}

			if (ownedEvent.canceledAt) {
				return {
					status: "error",
					message: "This event series is already canceled.",
				} satisfies CancellationFormState;
			}

			if (cancellation.data.scope === "event") {
				const canceledAt = new Date();
				const [updatedEvent] = await transaction
					.update(event)
					.set({
						canceledAt,
						canceledBy: session.user.id,
						updatedAt: canceledAt,
					})
					.where(
						and(
							eq(event.id, id.data),
							eq(event.submittedBy, session.user.id),
							isNull(event.canceledAt),
						),
					)
					.returning({ id: event.id });

				if (!updatedEvent) {
					return {
						status: "error",
						message: "This event series is already canceled.",
					} satisfies CancellationFormState;
				}

				return {
					status: "success",
					message: "Event canceled. It has been removed from the calendar.",
				} satisfies CancellationFormState;
			}

			const occurrenceDate = cancellation.data.occurrenceDate;
			const currentSacramentoDate = getSacramentoDateKey(new Date());

			if (occurrenceDate < currentSacramentoDate) {
				return {
					status: "error",
					message: "Past event occurrences cannot be canceled.",
				} satisfies CancellationFormState;
			}

			if (
				!ownedEvent.recurrenceFrequency ||
				!ownedEvent.recurrenceInterval ||
				!ownedEvent.recurrenceEndType
			) {
				return {
					status: "error",
					message: "Only repeating events have individual occurrences.",
				} satisfies CancellationFormState;
			}

			const recurrenceRule: RecurrenceRule = {
				endDate: ownedEvent.recurrenceEndDate,
				endType: ownedEvent.recurrenceEndType,
				excludedDates: [],
				frequency: ownedEvent.recurrenceFrequency,
				interval: ownedEvent.recurrenceInterval,
				monthlyPattern: ownedEvent.recurrenceMonthlyPattern,
				occurrenceCount: ownedEvent.recurrenceCount,
				weekdays: ownedEvent.recurrenceWeekdays,
			};
			const [scheduledOccurrence] = getOccurrencesInRange(
				ownedEvent.startsAt,
				recurrenceRule,
				occurrenceDate,
				occurrenceDate,
			);

			if (!scheduledOccurrence) {
				return {
					status: "error",
					message: "That date is not a scheduled occurrence of this event.",
				} satisfies CancellationFormState;
			}

			if (scheduledOccurrence <= new Date()) {
				return {
					status: "error",
					message: "Only future event occurrences can be canceled.",
				} satisfies CancellationFormState;
			}

			const [createdCancellation] = await transaction
				.insert(eventOccurrenceCancellation)
				.values({
					canceledBy: session.user.id,
					eventId: id.data,
					occurrenceDate,
				})
				.onConflictDoNothing()
				.returning({ id: eventOccurrenceCancellation.id });

			if (!createdCancellation) {
				return {
					status: "error",
					message: "That event occurrence is already canceled.",
				} satisfies CancellationFormState;
			}

			return {
				status: "success",
				message: "Occurrence canceled. The rest of the series is unchanged.",
			} satisfies CancellationFormState;
		});

		if (result.status === "success") {
			revalidatePath("/events");
			revalidatePath("/account");
			revalidatePath("/admin/events");
		}

		return result;
	} catch (error) {
		console.error("Unable to cancel event", error);
		return {
			status: "error",
			message: "We could not cancel this event right now. Please try again.",
		};
	}
}
