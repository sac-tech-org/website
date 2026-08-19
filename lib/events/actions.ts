"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { event, eventRecurrence } from "@/db/schema";
import { getCurrentSession, sessionIsAdmin } from "@/lib/session";
import type {
	EventFormState,
	ModerationFormState,
} from "@/lib/events/state";
import {
	SACRAMENTO_TIMEZONE,
	validateEventSubmission,
	validateModeration,
} from "@/lib/events/validation";

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
					timezone: SACRAMENTO_TIMEZONE,
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
		message: "Event submitted. A SacTech admin will review it before it appears.",
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
				: moderation.error.issues[0]?.message ?? "Check the review and try again.",
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
			.where(and(eq(event.id, id.data), eq(event.status, "pending")))
			.returning({ id: event.id });

		if (!updatedEvent) {
			return {
				status: "error",
				message: "This event has already been reviewed.",
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
