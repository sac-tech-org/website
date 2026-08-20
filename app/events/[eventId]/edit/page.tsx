import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
	EventForm,
	type EventFormValues,
} from "@/app/events/submit/event-form";
import type { RecurrenceRule } from "@/app/events/types";
import { requestEventEdit } from "@/lib/events/actions";
import { getManagedEventForEdit } from "@/lib/events/queries";
import {
	getNextFutureOccurrence,
	getOccurrenceEnd,
	getOccurrencesInRange,
	getSacramentoDateKey,
} from "@/lib/events/recurrence";
import { requireSession } from "@/lib/session";
import { CollaboratorInviteForm } from "./collaborator-invite-form";
import editStyle from "./edit-event.module.css";
import formStyle from "../../submit/event-form.module.css";

export const metadata: Metadata = {
	title: "Edit event",
	description: "Propose changes to an event on the SacTech community calendar.",
};

interface EditEventPageProps {
	params: Promise<{ eventId: string }>;
	searchParams: Promise<{
		occurrenceDate?: string | string[];
		scope?: string | string[];
	}>;
}

function firstQueryValue(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

function formatLocalDateTime(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;

	return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

function recurrenceRuleFor(event: {
	recurrenceCount: number | null;
	recurrenceEndDate: string | null;
	recurrenceEndType: RecurrenceRule["endType"] | null;
	recurrenceFrequency: RecurrenceRule["frequency"] | null;
	recurrenceInterval: number | null;
	recurrenceMonthlyPattern: RecurrenceRule["monthlyPattern"];
	recurrenceWeekdays: number[] | null;
}): RecurrenceRule | null {
	if (
		!event.recurrenceFrequency ||
		!event.recurrenceInterval ||
		!event.recurrenceEndType
	) {
		return null;
	}

	return {
		endDate: event.recurrenceEndDate,
		endType: event.recurrenceEndType,
		excludedDates: [],
		frequency: event.recurrenceFrequency,
		interval: event.recurrenceInterval,
		monthlyPattern: event.recurrenceMonthlyPattern,
		occurrenceCount: event.recurrenceCount,
		weekdays: event.recurrenceWeekdays,
	};
}

function formValuesFor(
	event: {
		description: string;
		endsAt: Date;
		eventUrl: string | null;
		locationAddress: string | null;
		locationName: string | null;
		mode: "hybrid" | "in_person" | "online";
		startsAt: Date;
		timezone: string;
		title: string;
	},
	recurrence: RecurrenceRule | null,
): EventFormValues {
	return {
		description: event.description,
		endsAt: formatLocalDateTime(event.endsAt, event.timezone),
		eventUrl: event.eventUrl ?? "",
		locationAddress: event.locationAddress ?? "",
		locationName: event.locationName ?? "",
		mode: event.mode,
		recurrenceCount: String(recurrence?.occurrenceCount ?? 10),
		recurrenceEndDate: recurrence?.endDate ?? "",
		recurrenceEndType: recurrence?.endType ?? "never",
		recurrenceFrequency: recurrence?.frequency ?? "week",
		recurrenceInterval: String(recurrence?.interval ?? 1),
		recurrenceMonthlyPattern: recurrence?.monthlyPattern ?? "day_of_month",
		recurrenceWeekdays: recurrence?.weekdays ?? [0],
		recurring: recurrence !== null,
		startsAt: formatLocalDateTime(event.startsAt, event.timezone),
		title: event.title,
	};
}

export default async function EditEventPage({
	params,
	searchParams,
}: EditEventPageProps) {
	const session = await requireSession();
	const { eventId } = await params;
	const query = await searchParams;

	if (!z.uuid().safeParse(eventId).success) {
		notFound();
	}

	const requestedScope = firstQueryValue(query.scope);
	const scope = requestedScope === "occurrence" ? "occurrence" : "series";
	const requestedOccurrenceDate = firstQueryValue(query.occurrenceDate) ?? null;
	const occurrenceDate =
		scope === "occurrence" &&
		requestedOccurrenceDate &&
		z.iso.date().safeParse(requestedOccurrenceDate).success
			? requestedOccurrenceDate
			: null;
	const managedEvent = await getManagedEventForEdit(
		eventId,
		session.user.id,
		occurrenceDate,
	);

	if (!managedEvent) {
		notFound();
	}

	const recurrence = recurrenceRuleFor(managedEvent);
	const canEditOccurrence =
		managedEvent.status === "approved" && recurrence !== null;
	const today = getSacramentoDateKey(new Date());
	const nextOccurrence = recurrence
		? getNextFutureOccurrence(
				managedEvent.startsAt,
				{
					...recurrence,
					excludedDates: managedEvent.canceledOccurrences,
				},
				new Date(),
			)
		: null;
	const suggestedOccurrenceDate = nextOccurrence
		? getSacramentoDateKey(nextOccurrence)
		: "";
	let occurrenceUnavailableMessage: string | null = null;
	let effectiveOccurrence:
		| (typeof managedEvent.occurrenceOverride & object)
		| {
				description: string;
				endsAt: Date;
				eventUrl: string | null;
				locationAddress: string | null;
				locationName: string | null;
				mode: "hybrid" | "in_person" | "online";
				startsAt: Date;
				timezone: string;
				title: string;
		  }
		| null = null;

	if (scope === "occurrence" && occurrenceDate && recurrence) {
		const [scheduledStart] = getOccurrencesInRange(
			managedEvent.startsAt,
			recurrence,
			occurrenceDate,
			occurrenceDate,
		);
		const isCanceled =
			managedEvent.canceledOccurrences.includes(occurrenceDate);

		if (!scheduledStart) {
			occurrenceUnavailableMessage =
				"That date is not part of this event's current schedule.";
		} else if (isCanceled) {
			occurrenceUnavailableMessage = "That occurrence has been canceled.";
		} else {
			effectiveOccurrence =
				managedEvent.occurrenceOverride ??
				({
					description: managedEvent.description,
					endsAt: getOccurrenceEnd(
						managedEvent.startsAt,
						managedEvent.endsAt,
						scheduledStart,
					),
					eventUrl: managedEvent.eventUrl,
					locationAddress: managedEvent.locationAddress,
					locationName: managedEvent.locationName,
					mode: managedEvent.mode,
					startsAt: scheduledStart,
					timezone: managedEvent.timezone,
					title: managedEvent.title,
				} as const);

			if (effectiveOccurrence.startsAt <= new Date()) {
				occurrenceUnavailableMessage =
					"Only future event occurrences can be edited.";
				effectiveOccurrence = null;
			}
		}
	}

	const matchingPendingRequest = managedEvent.changeRequests.find(
		(change) =>
			change.status === "pending" &&
			change.scope === scope &&
			(scope === "series" || change.occurrenceDate === occurrenceDate),
	);
	const matchingRejection = managedEvent.changeRequests.find(
		(change) =>
			change.status === "rejected" &&
			change.scope === scope &&
			(scope === "series" || change.occurrenceDate === occurrenceDate),
	);
	const seriesValues = formValuesFor(managedEvent, recurrence);
	const occurrenceValues = effectiveOccurrence
		? formValuesFor(effectiveOccurrence, null)
		: null;
	const editAction = requestEventEdit.bind(
		null,
		eventId,
		scope,
		scope === "occurrence" ? occurrenceDate : null,
	);

	return (
		<main className={formStyle.page} id="main-content">
			<section aria-labelledby="page-title" className={formStyle.hero}>
				<div className={formStyle.heroInner}>
					<p className={formStyle.eyebrow}>Manage event</p>
					<h1 id="page-title">Edit {managedEvent.title}.</h1>
					<p>
						Changes go to a SacTech reviewer before they replace anything
						already on the public calendar.
					</p>
				</div>
			</section>

			<section aria-labelledby="edit-guide-title" className={formStyle.content}>
				<div className={formStyle.layout}>
					<aside className={formStyle.guide}>
						<p className={formStyle.guideEyebrow}>Choose what changes</p>
						<h2 id="edit-guide-title">
							{scope === "occurrence" ? "One occurrence" : "The whole event"}
						</h2>
						<nav aria-label="Event edit scope" className={editStyle.scopeNav}>
							<Link
								aria-current={scope === "series" ? "page" : undefined}
								href={`/events/${eventId}/edit?scope=series`}
							>
								Edit the whole {recurrence ? "series" : "event"}
							</Link>
							{canEditOccurrence && (
								<Link
									aria-current={scope === "occurrence" ? "page" : undefined}
									href={`/events/${eventId}/edit?scope=occurrence`}
								>
									Edit one occurrence
								</Link>
							)}
						</nav>
						<p className={formStyle.reviewNote}>
							<strong>The current version stays live during review.</strong>
							Approving a whole-series change updates every inherited date.
							Approving one occurrence changes only that selected session.
						</p>
						<Link className={editStyle.backLink} href="/account">
							← Back to your account
						</Link>
					</aside>

					<div className={editStyle.rightColumn}>
						{scope === "occurrence" &&
							canEditOccurrence &&
							!managedEvent.canceledAt && (
								<section className={editStyle.occurrencePicker}>
									<h3>Choose the occurrence</h3>
									<form action={`/events/${eventId}/edit`} method="get">
										<input name="scope" type="hidden" value="occurrence" />
										<label htmlFor="occurrenceDate">Scheduled date</label>
										<div>
											<input
												defaultValue={occurrenceDate ?? suggestedOccurrenceDate}
												id="occurrenceDate"
												min={today}
												name="occurrenceDate"
												required
												type="date"
											/>
											<button type="submit">Load this occurrence</button>
										</div>
									</form>
								</section>
							)}

						{managedEvent.canceledAt ? (
							<div className={editStyle.notice} role="alert">
								This event is canceled and can no longer be edited or shared.
							</div>
						) : scope === "occurrence" && !canEditOccurrence ? (
							<div className={editStyle.notice} role="alert">
								Individual occurrences are available after a recurring series is
								approved.
							</div>
						) : occurrenceUnavailableMessage ? (
							<div className={editStyle.notice} role="alert">
								{occurrenceUnavailableMessage}
							</div>
						) : matchingPendingRequest ? (
							<div className={editStyle.pendingNotice} role="status">
								<h3>Changes are already waiting for review</h3>
								<p>
									A reviewer must approve or reject that request before another
									change can be submitted for this target.
								</p>
							</div>
						) : scope === "series" || occurrenceValues ? (
							<>
								{matchingRejection?.moderationNote && (
									<div className={editStyle.rejectionNote}>
										<strong>Note from the reviewer</strong>
										<p>{matchingRejection.moderationNote}</p>
									</div>
								)}
								<div className={formStyle.formCard}>
									<EventForm
										action={editAction}
										allowRecurrence={scope === "series"}
										initialValues={
											scope === "series" ? seriesValues : occurrenceValues!
										}
										variant="edit"
									/>
								</div>
							</>
						) : null}

						{managedEvent.isOwner && !managedEvent.canceledAt && (
							<section
								aria-labelledby="collaborators-title"
								className={editStyle.collaborationPanel}
							>
								<p className={editStyle.panelEyebrow}>Shared access</p>
								<h2 id="collaborators-title">Invite another editor</h2>
								<p>
									Invite someone with an existing SacTech account. They can edit
									or cancel this event, including individual occurrences.
								</p>
								<CollaboratorInviteForm eventId={eventId} />
								{managedEvent.collaborators.length > 0 && (
									<div className={editStyle.collaboratorList}>
										<h3>People with access</h3>
										<ul>
											{managedEvent.collaborators.map((collaborator) => (
												<li key={collaborator.userId}>
													<strong>{collaborator.name}</strong>
													<span>{collaborator.email}</span>
												</li>
											))}
										</ul>
									</div>
								)}
							</section>
						)}
					</div>
				</div>
			</section>
		</main>
	);
}
