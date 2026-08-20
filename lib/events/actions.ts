"use server";

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
	event,
	eventChangeRequest,
	eventCollaborator,
	eventOccurrenceCancellation,
	eventOccurrenceOverride,
	eventRecurrence,
} from "@/db/schema";
import type { RecurrenceRule } from "@/app/events/types";
import { roleHasEventPermission } from "@/lib/auth-permissions";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import {
	getCurrentSession,
	sessionCanCancelOwnEvents,
	sessionCanReviewEvents,
	sessionCanSubmitEvents,
} from "@/lib/session";
import type {
	CancellationFormState,
	CollaboratorFormState,
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

const changeTargetSchema = z.discriminatedUnion("scope", [
	z.object({
		eventId: z.uuid(),
		occurrenceDate: z.null(),
		scope: z.literal("series"),
	}),
	z.object({
		eventId: z.uuid(),
		occurrenceDate: z.iso.date(),
		scope: z.literal("occurrence"),
	}),
]);

const collaboratorEmailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(
		z
			.email("Enter the email address for an existing SacTech account.")
			.max(320),
	);

function eventAccessJoin(userId: string) {
	return and(
		eq(eventCollaborator.eventId, event.id),
		eq(eventCollaborator.userId, userId),
	);
}

function eventAccessCondition(userId: string) {
	return or(
		eq(event.submittedBy, userId),
		eq(eventCollaborator.userId, userId),
	);
}

function recurrenceRuleFromRow(row: {
	recurrenceCount: number | null;
	recurrenceEndDate: string | null;
	recurrenceEndType: RecurrenceRule["endType"] | null;
	recurrenceFrequency: RecurrenceRule["frequency"] | null;
	recurrenceInterval: number | null;
	recurrenceMonthlyPattern: RecurrenceRule["monthlyPattern"];
	recurrenceWeekdays: number[] | null;
}): RecurrenceRule | null {
	if (
		!row.recurrenceFrequency ||
		!row.recurrenceInterval ||
		!row.recurrenceEndType
	) {
		return null;
	}

	return {
		endDate: row.recurrenceEndDate,
		endType: row.recurrenceEndType,
		excludedDates: [],
		frequency: row.recurrenceFrequency,
		interval: row.recurrenceInterval,
		monthlyPattern: row.recurrenceMonthlyPattern,
		occurrenceCount: row.recurrenceCount,
		weekdays: row.recurrenceWeekdays,
	};
}

function sameNullableArray(left: number[] | null, right: number[] | null) {
	if (left === right) {
		return true;
	}

	if (!left || !right || left.length !== right.length) {
		return false;
	}

	return left.every((value, index) => value === right[index]);
}

export async function submitEvent(
	_previousState: EventFormState,
	formData: FormData,
): Promise<EventFormState> {
	const session = await getCurrentSession();

	if (!session || !sessionCanSubmitEvents(session)) {
		return {
			status: "error",
			message: session
				? "You do not have permission to submit events."
				: "Your session expired. Sign in again before submitting.",
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
			message: "We couldn't save your event right now. Try again.",
		};
	}

	revalidatePath("/account");
	revalidatePath("/admin/events");

	return {
		status: "success",
		message:
			"Event submitted. A SacTech reviewer will check it before it appears.",
	};
}

export async function inviteEventCollaborator(
	eventId: string,
	_previousState: CollaboratorFormState,
	formData: FormData,
): Promise<CollaboratorFormState> {
	const session = await getCurrentSession();

	if (!session || !sessionCanSubmitEvents(session)) {
		return {
			status: "error",
			message: session
				? "You do not have permission to share event access."
				: "Your session expired. Sign in again before inviting someone.",
		};
	}

	const id = z.uuid().safeParse(eventId);
	const email = collaboratorEmailSchema.safeParse(formData.get("email"));

	if (!id.success || !email.success) {
		return {
			status: "error",
			message: id.success
				? (email.error?.issues[0]?.message ?? "Enter a valid email address.")
				: "That event could not be found.",
		};
	}

	try {
		const result = await db.transaction(async (transaction) => {
			const [ownedEvent] = await transaction
				.select({ canceledAt: event.canceledAt })
				.from(event)
				.where(
					and(eq(event.id, id.data), eq(event.submittedBy, session.user.id)),
				)
				.limit(1)
				.for("update", { of: event });

			if (!ownedEvent || ownedEvent.canceledAt) {
				return {
					status: "error",
					message: ownedEvent
						? "Canceled events cannot be shared."
						: "Only the original submitter can invite event editors.",
				} satisfies CollaboratorFormState;
			}

			const [invitee] = await transaction
				.select({
					banExpires: user.banExpires,
					banned: user.banned,
					email: user.email,
					id: user.id,
					role: user.role,
				})
				.from(user)
				.where(sql`lower(${user.email}) = ${email.data}`)
				.limit(1);

			if (!invitee) {
				return {
					status: "error",
					message: "No SacTech account uses that email address yet.",
				} satisfies CollaboratorFormState;
			}

			if (invitee.id === session.user.id) {
				return {
					status: "error",
					message: "You already manage this event as its submitter.",
				} satisfies CollaboratorFormState;
			}

			const banIsActive = Boolean(
				invitee.banned &&
				(!invitee.banExpires || invitee.banExpires > new Date()),
			);

			if (banIsActive || !roleHasEventPermission(invitee.role, "submit")) {
				return {
					status: "error",
					message: "That account cannot manage events.",
				} satisfies CollaboratorFormState;
			}

			const [created] = await transaction
				.insert(eventCollaborator)
				.values({
					eventId: id.data,
					invitedBy: session.user.id,
					userId: invitee.id,
				})
				.onConflictDoNothing()
				.returning({ id: eventCollaborator.id });

			if (!created) {
				return {
					status: "error",
					message: `${invitee.email} can already edit and cancel this event.`,
				} satisfies CollaboratorFormState;
			}

			return {
				status: "success",
				message: `${invitee.email} can now edit and cancel this event.`,
			} satisfies CollaboratorFormState;
		});

		if (result.status === "success") {
			revalidatePath("/account");
			revalidatePath(`/events/${id.data}/edit`);
		}

		return result;
	} catch (error) {
		console.error("Unable to invite event collaborator", error);
		return {
			status: "error",
			message: "We couldn't share this event right now. Try again.",
		};
	}
}

export async function requestEventEdit(
	eventId: string,
	scope: "series" | "occurrence",
	occurrenceDate: string | null,
	_previousState: EventFormState,
	formData: FormData,
): Promise<EventFormState> {
	const session = await getCurrentSession();

	if (!session || !sessionCanSubmitEvents(session)) {
		return {
			status: "error",
			message: session
				? "You do not have permission to edit events."
				: "Your session expired. Sign in again before saving changes.",
		};
	}

	const target = changeTargetSchema.safeParse({
		eventId,
		occurrenceDate,
		scope,
	});

	if (!target.success) {
		return {
			status: "error",
			message: "That event or occurrence could not be found.",
		};
	}

	try {
		const result = await db.transaction(async (transaction) => {
			const [managedEvent] = await transaction
				.select({
					canceledAt: event.canceledAt,
					contentVersion: event.contentVersion,
					recurrenceCount: eventRecurrence.occurrenceCount,
					recurrenceEndDate: eventRecurrence.endDate,
					recurrenceEndType: eventRecurrence.endType,
					recurrenceFrequency: eventRecurrence.frequency,
					recurrenceInterval: eventRecurrence.interval,
					recurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
					recurrenceWeekdays: eventRecurrence.weekdays,
					startsAt: event.startsAt,
					status: event.status,
				})
				.from(event)
				.leftJoin(eventCollaborator, eventAccessJoin(session.user.id))
				.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
				.where(
					and(
						eq(event.id, target.data.eventId),
						eventAccessCondition(session.user.id),
					),
				)
				.limit(1)
				.for("update", { of: event });

			if (!managedEvent) {
				return {
					status: "error",
					message: "That event is not available in your managed events.",
				} satisfies EventFormState;
			}

			if (managedEvent.canceledAt) {
				return {
					status: "error",
					message: "Canceled events cannot be edited.",
				} satisfies EventFormState;
			}

			const validation = validateEventSubmission(formData, {
				allowRecurrence: target.data.scope === "series",
				permittedPastStart:
					target.data.scope === "series" ? managedEvent.startsAt : undefined,
			});

			if (!validation.data) {
				return {
					status: "error",
					message: "Check the highlighted fields and try again.",
					errors: validation.errors,
				} satisfies EventFormState;
			}

			const { recurrence, ...eventValues } = validation.data;

			if (
				target.data.scope === "series" &&
				managedEvent.status !== "approved"
			) {
				await transaction
					.update(event)
					.set({
						...eventValues,
						contentVersion: sql`${event.contentVersion} + 1`,
						locationAddress: eventValues.locationAddress ?? null,
						locationName: eventValues.locationName ?? null,
						eventUrl: eventValues.eventUrl ?? null,
						moderationNote: null,
						reviewedAt: null,
						reviewedBy: null,
						status: "pending",
						updatedAt: new Date(),
					})
					.where(eq(event.id, target.data.eventId));
				await transaction
					.delete(eventRecurrence)
					.where(eq(eventRecurrence.eventId, target.data.eventId));

				if (recurrence) {
					await transaction.insert(eventRecurrence).values({
						...recurrence,
						eventId: target.data.eventId,
					});
				}

				return {
					status: "success",
					message: "Event updated and sent back to the review queue.",
				} satisfies EventFormState;
			}

			if (managedEvent.status !== "approved") {
				return {
					status: "error",
					message:
						"Individual occurrences can be edited after the series is approved.",
				} satisfies EventFormState;
			}

			const [pendingRequest] = await transaction
				.select({ id: eventChangeRequest.id })
				.from(eventChangeRequest)
				.where(
					and(
						eq(eventChangeRequest.eventId, target.data.eventId),
						eq(eventChangeRequest.scope, target.data.scope),
						target.data.scope === "series"
							? isNull(eventChangeRequest.occurrenceDate)
							: eq(
									eventChangeRequest.occurrenceDate,
									target.data.occurrenceDate,
								),
						eq(eventChangeRequest.status, "pending"),
					),
				)
				.limit(1);

			if (pendingRequest) {
				return {
					status: "error",
					message:
						target.data.scope === "series"
							? "This series already has changes waiting for review."
							: "That occurrence already has changes waiting for review.",
				} satisfies EventFormState;
			}

			let baseOccurrenceVersion = 0;

			if (target.data.scope === "occurrence") {
				const recurrenceRule = recurrenceRuleFromRow(managedEvent);

				if (!recurrenceRule) {
					return {
						status: "error",
						message: "Only repeating events have individual occurrences.",
					} satisfies EventFormState;
				}

				const [scheduledOccurrence] = getOccurrencesInRange(
					managedEvent.startsAt,
					recurrenceRule,
					target.data.occurrenceDate,
					target.data.occurrenceDate,
				);
				const [[cancellation], [existingOverride]] = await Promise.all([
					transaction
						.select({ id: eventOccurrenceCancellation.id })
						.from(eventOccurrenceCancellation)
						.where(
							and(
								eq(eventOccurrenceCancellation.eventId, target.data.eventId),
								eq(
									eventOccurrenceCancellation.occurrenceDate,
									target.data.occurrenceDate,
								),
							),
						)
						.limit(1),
					transaction
						.select({
							startsAt: eventOccurrenceOverride.startsAt,
							version: eventOccurrenceOverride.version,
						})
						.from(eventOccurrenceOverride)
						.where(
							and(
								eq(eventOccurrenceOverride.eventId, target.data.eventId),
								eq(
									eventOccurrenceOverride.occurrenceDate,
									target.data.occurrenceDate,
								),
							),
						)
						.limit(1),
				]);
				const effectiveStart =
					existingOverride?.startsAt ?? scheduledOccurrence;

				if (!scheduledOccurrence) {
					return {
						status: "error",
						message: "That date is not a scheduled occurrence of this event.",
					} satisfies EventFormState;
				}

				if (cancellation) {
					return {
						status: "error",
						message: "Canceled occurrences cannot be edited.",
					} satisfies EventFormState;
				}

				if (!effectiveStart || effectiveStart <= new Date()) {
					return {
						status: "error",
						message: "Only future event occurrences can be edited.",
					} satisfies EventFormState;
				}

				baseOccurrenceVersion = existingOverride?.version ?? 0;
			}

			await transaction.insert(eventChangeRequest).values({
				baseContentVersion: managedEvent.contentVersion,
				baseOccurrenceVersion,
				description: eventValues.description,
				endsAt: eventValues.endsAt,
				eventId: target.data.eventId,
				eventUrl: eventValues.eventUrl ?? null,
				locationAddress: eventValues.locationAddress ?? null,
				locationName: eventValues.locationName ?? null,
				mode: eventValues.mode,
				occurrenceDate:
					target.data.scope === "occurrence"
						? target.data.occurrenceDate
						: null,
				proposedBy: session.user.id,
				recurrenceEndDate: recurrence?.endDate ?? null,
				recurrenceEndType: recurrence?.endType ?? null,
				recurrenceFrequency: recurrence?.frequency ?? null,
				recurrenceInterval: recurrence?.interval ?? null,
				recurrenceMonthlyPattern: recurrence?.monthlyPattern ?? null,
				recurrenceOccurrenceCount: recurrence?.occurrenceCount ?? null,
				recurrenceWeekdays: recurrence?.weekdays ?? null,
				scope: target.data.scope,
				startsAt: eventValues.startsAt,
				status: "pending",
				timezone: SACRAMENTO_TIME_ZONE,
				title: eventValues.title,
			});

			return {
				status: "success",
				message:
					target.data.scope === "series"
						? "Series changes sent for review. The current version stays live until they are approved."
						: "Occurrence changes sent for review. The current details stay live until they are approved.",
			} satisfies EventFormState;
		});

		if (result.status === "success") {
			revalidatePath("/account");
			revalidatePath("/admin/events");
			revalidatePath(`/events/${target.data.eventId}/edit`);
		}

		return result;
	} catch (error) {
		console.error("Unable to save event changes", error);
		return {
			status: "error",
			message: "We couldn't save these changes right now. Try again.",
		};
	}
}

export async function moderateEvent(
	eventId: string,
	_previousState: ModerationFormState,
	formData: FormData,
): Promise<ModerationFormState> {
	const session = await getCurrentSession();

	if (!session || !sessionCanReviewEvents(session)) {
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
			message: "We couldn't save this review. Try again.",
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

export async function moderateEventEdit(
	changeRequestId: string,
	_previousState: ModerationFormState,
	formData: FormData,
): Promise<ModerationFormState> {
	const session = await getCurrentSession();

	if (!session || !sessionCanReviewEvents(session)) {
		return {
			status: "error",
			message: "You do not have permission to review event changes.",
		};
	}

	const id = z.uuid().safeParse(changeRequestId);
	const moderation = validateModeration(formData);

	if (!id.success || !moderation.success) {
		return {
			status: "error",
			message: moderation.success
				? "That change request could not be found."
				: (moderation.error.issues[0]?.message ??
					"Check the review and try again."),
		};
	}

	try {
		const result = await db.transaction(async (transaction) => {
			const [change] = await transaction
				.select({
					baseContentVersion: eventChangeRequest.baseContentVersion,
					baseOccurrenceVersion: eventChangeRequest.baseOccurrenceVersion,
					description: eventChangeRequest.description,
					endsAt: eventChangeRequest.endsAt,
					eventId: eventChangeRequest.eventId,
					eventUrl: eventChangeRequest.eventUrl,
					locationAddress: eventChangeRequest.locationAddress,
					locationName: eventChangeRequest.locationName,
					mode: eventChangeRequest.mode,
					occurrenceDate: eventChangeRequest.occurrenceDate,
					recurrenceCount: eventChangeRequest.recurrenceOccurrenceCount,
					recurrenceEndDate: eventChangeRequest.recurrenceEndDate,
					recurrenceEndType: eventChangeRequest.recurrenceEndType,
					recurrenceFrequency: eventChangeRequest.recurrenceFrequency,
					recurrenceInterval: eventChangeRequest.recurrenceInterval,
					recurrenceMonthlyPattern: eventChangeRequest.recurrenceMonthlyPattern,
					recurrenceWeekdays: eventChangeRequest.recurrenceWeekdays,
					scope: eventChangeRequest.scope,
					startsAt: eventChangeRequest.startsAt,
					status: eventChangeRequest.status,
					timezone: eventChangeRequest.timezone,
					title: eventChangeRequest.title,
				})
				.from(eventChangeRequest)
				.where(eq(eventChangeRequest.id, id.data))
				.limit(1)
				.for("update", { of: eventChangeRequest });

			if (!change || change.status !== "pending") {
				return {
					status: "error",
					message: "This change request has already been reviewed.",
				} satisfies ModerationFormState;
			}

			if (moderation.data.decision === "rejected") {
				await transaction
					.update(eventChangeRequest)
					.set({
						moderationNote: moderation.data.note ?? null,
						reviewedAt: new Date(),
						reviewedBy: session.user.id,
						status: "rejected",
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(eventChangeRequest.id, id.data),
							eq(eventChangeRequest.status, "pending"),
						),
					);

				return {
					status: "success",
					message: "Changes rejected. The editor can see your note.",
				} satisfies ModerationFormState;
			}

			const [currentEvent] = await transaction
				.select({
					canceledAt: event.canceledAt,
					contentVersion: event.contentVersion,
					recurrenceCount: eventRecurrence.occurrenceCount,
					recurrenceEndDate: eventRecurrence.endDate,
					recurrenceEndType: eventRecurrence.endType,
					recurrenceFrequency: eventRecurrence.frequency,
					recurrenceInterval: eventRecurrence.interval,
					recurrenceMonthlyPattern: eventRecurrence.monthlyPattern,
					recurrenceWeekdays: eventRecurrence.weekdays,
					startsAt: event.startsAt,
					status: event.status,
				})
				.from(event)
				.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
				.where(eq(event.id, change.eventId))
				.limit(1)
				.for("update", { of: event });

			if (
				!currentEvent ||
				currentEvent.canceledAt ||
				currentEvent.status !== "approved"
			) {
				return {
					status: "error",
					message: "The event is no longer available for this change.",
				} satisfies ModerationFormState;
			}

			if (currentEvent.contentVersion !== change.baseContentVersion) {
				return {
					status: "error",
					message:
						"The live event changed after this request was submitted. Ask the editor to review and resubmit it.",
				} satisfies ModerationFormState;
			}

			if (change.scope === "series") {
				const scheduleChanged =
					currentEvent.startsAt.getTime() !== change.startsAt.getTime() ||
					currentEvent.recurrenceFrequency !== change.recurrenceFrequency ||
					currentEvent.recurrenceInterval !== change.recurrenceInterval ||
					!sameNullableArray(
						currentEvent.recurrenceWeekdays,
						change.recurrenceWeekdays,
					) ||
					currentEvent.recurrenceMonthlyPattern !==
						change.recurrenceMonthlyPattern ||
					currentEvent.recurrenceEndType !== change.recurrenceEndType ||
					currentEvent.recurrenceEndDate !== change.recurrenceEndDate ||
					currentEvent.recurrenceCount !== change.recurrenceCount;

				await transaction
					.update(event)
					.set({
						contentVersion: sql`${event.contentVersion} + 1`,
						description: change.description,
						endsAt: change.endsAt,
						eventUrl: change.eventUrl,
						locationAddress: change.locationAddress,
						locationName: change.locationName,
						mode: change.mode,
						startsAt: change.startsAt,
						timezone: change.timezone,
						title: change.title,
						updatedAt: new Date(),
					})
					.where(eq(event.id, change.eventId));

				await transaction
					.delete(eventRecurrence)
					.where(eq(eventRecurrence.eventId, change.eventId));

				if (
					change.recurrenceFrequency &&
					change.recurrenceInterval &&
					change.recurrenceEndType
				) {
					await transaction.insert(eventRecurrence).values({
						endDate: change.recurrenceEndDate,
						endType: change.recurrenceEndType,
						eventId: change.eventId,
						frequency: change.recurrenceFrequency,
						interval: change.recurrenceInterval,
						monthlyPattern: change.recurrenceMonthlyPattern,
						occurrenceCount: change.recurrenceCount,
						weekdays: change.recurrenceWeekdays,
					});
				}

				if (scheduleChanged) {
					await transaction
						.delete(eventOccurrenceCancellation)
						.where(eq(eventOccurrenceCancellation.eventId, change.eventId));
					await transaction
						.delete(eventOccurrenceOverride)
						.where(eq(eventOccurrenceOverride.eventId, change.eventId));
				}
			} else {
				if (!change.occurrenceDate) {
					throw new Error("Occurrence change is missing its date anchor.");
				}

				const recurrenceRule = recurrenceRuleFromRow(currentEvent);
				const [scheduledOccurrence] = recurrenceRule
					? getOccurrencesInRange(
							currentEvent.startsAt,
							recurrenceRule,
							change.occurrenceDate,
							change.occurrenceDate,
						)
					: [];
				const [[cancellation], [currentOverride]] = await Promise.all([
					transaction
						.select({ id: eventOccurrenceCancellation.id })
						.from(eventOccurrenceCancellation)
						.where(
							and(
								eq(eventOccurrenceCancellation.eventId, change.eventId),
								eq(
									eventOccurrenceCancellation.occurrenceDate,
									change.occurrenceDate,
								),
							),
						)
						.limit(1),
					transaction
						.select({ version: eventOccurrenceOverride.version })
						.from(eventOccurrenceOverride)
						.where(
							and(
								eq(eventOccurrenceOverride.eventId, change.eventId),
								eq(
									eventOccurrenceOverride.occurrenceDate,
									change.occurrenceDate,
								),
							),
						)
						.limit(1),
				]);

				if (!scheduledOccurrence || cancellation) {
					return {
						status: "error",
						message: "That occurrence is no longer available for editing.",
					} satisfies ModerationFormState;
				}

				if ((currentOverride?.version ?? 0) !== change.baseOccurrenceVersion) {
					return {
						status: "error",
						message:
							"That occurrence changed after this request was submitted. Ask the editor to resubmit it.",
					} satisfies ModerationFormState;
				}

				if (change.startsAt <= new Date()) {
					return {
						status: "error",
						message: "That occurrence is no longer in the future.",
					} satisfies ModerationFormState;
				}

				await transaction
					.insert(eventOccurrenceOverride)
					.values({
						approvedChangeId: id.data,
						description: change.description,
						endsAt: change.endsAt,
						eventId: change.eventId,
						eventUrl: change.eventUrl,
						locationAddress: change.locationAddress,
						locationName: change.locationName,
						mode: change.mode,
						occurrenceDate: change.occurrenceDate,
						startsAt: change.startsAt,
						timezone: change.timezone,
						title: change.title,
						version: change.baseOccurrenceVersion + 1,
					})
					.onConflictDoUpdate({
						set: {
							approvedChangeId: id.data,
							description: change.description,
							endsAt: change.endsAt,
							eventUrl: change.eventUrl,
							locationAddress: change.locationAddress,
							locationName: change.locationName,
							mode: change.mode,
							startsAt: change.startsAt,
							timezone: change.timezone,
							title: change.title,
							updatedAt: new Date(),
							version: change.baseOccurrenceVersion + 1,
						},
						target: [
							eventOccurrenceOverride.eventId,
							eventOccurrenceOverride.occurrenceDate,
						],
					});
			}

			await transaction
				.update(eventChangeRequest)
				.set({
					moderationNote: moderation.data.note ?? null,
					reviewedAt: new Date(),
					reviewedBy: session.user.id,
					status: "approved",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(eventChangeRequest.id, id.data),
						eq(eventChangeRequest.status, "pending"),
					),
				);

			return {
				status: "success",
				message:
					change.scope === "series"
						? "Series changes approved and published."
						: "Occurrence changes approved and published.",
			} satisfies ModerationFormState;
		});

		if (result.status === "success") {
			revalidatePath("/events");
			revalidatePath("/account");
			revalidatePath("/admin/events");
		}

		return result;
	} catch (error) {
		console.error("Unable to moderate event changes", error);
		return {
			status: "error",
			message: "We couldn't save this change review. Try again.",
		};
	}
}

export async function cancelEvent(
	eventId: string,
	_previousState: CancellationFormState,
	formData: FormData,
): Promise<CancellationFormState> {
	const session = await getCurrentSession();

	if (!session || !sessionCanCancelOwnEvents(session)) {
		return {
			status: "error",
			message: session
				? "You do not have permission to cancel events."
				: "Your session expired. Sign in again before canceling.",
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
				.leftJoin(eventCollaborator, eventAccessJoin(session.user.id))
				.leftJoin(eventRecurrence, eq(event.id, eventRecurrence.eventId))
				.where(
					and(eq(event.id, id.data), eventAccessCondition(session.user.id)),
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
					.where(and(eq(event.id, id.data), isNull(event.canceledAt)))
					.returning({ id: event.id });

				if (!updatedEvent) {
					return {
						status: "error",
						message: "This event series is already canceled.",
					} satisfies CancellationFormState;
				}

				await transaction
					.delete(eventChangeRequest)
					.where(
						and(
							eq(eventChangeRequest.eventId, id.data),
							eq(eventChangeRequest.status, "pending"),
						),
					);

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

			await transaction
				.delete(eventChangeRequest)
				.where(
					and(
						eq(eventChangeRequest.eventId, id.data),
						eq(eventChangeRequest.scope, "occurrence"),
						eq(eventChangeRequest.occurrenceDate, occurrenceDate),
						eq(eventChangeRequest.status, "pending"),
					),
				);
			await transaction
				.delete(eventOccurrenceOverride)
				.where(
					and(
						eq(eventOccurrenceOverride.eventId, id.data),
						eq(eventOccurrenceOverride.occurrenceDate, occurrenceDate),
					),
				);

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
			message: "We couldn't cancel this event right now. Try again.",
		};
	}
}
