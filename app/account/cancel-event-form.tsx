"use client";

import { useActionState, useState } from "react";
import { cancelEvent } from "@/lib/events/actions";
import { initialCancellationFormState } from "@/lib/events/state";
import style from "./account.module.css";

interface CancelEventFormProps {
	defaultOccurrenceDate: string | null;
	eventId: string;
	eventTitle: string;
	isRecurring: boolean;
	maxOccurrenceDate: string | null;
	minOccurrenceDate: string;
}

const occurrenceDateFormatter = new Intl.DateTimeFormat("en-US", {
	dateStyle: "long",
	timeZone: "UTC",
});

function formatOccurrenceDate(dateKey: string) {
	return occurrenceDateFormatter.format(new Date(`${dateKey}T12:00:00Z`));
}

export function CancelEventForm({
	defaultOccurrenceDate,
	eventId,
	eventTitle,
	isRecurring,
	maxOccurrenceDate,
	minOccurrenceDate,
}: CancelEventFormProps) {
	const cancelBoundEvent = cancelEvent.bind(null, eventId);
	const [occurrenceState, occurrenceAction, occurrencePending] = useActionState(
		cancelBoundEvent,
		initialCancellationFormState,
	);
	const [eventState, eventAction, eventPending] = useActionState(
		cancelBoundEvent,
		initialCancellationFormState,
	);
	const [occurrenceSelection, setOccurrenceSelection] = useState({
		defaultDate: defaultOccurrenceDate,
		value: defaultOccurrenceDate ?? "",
	});
	const pending = occurrencePending || eventPending;

	if (occurrenceSelection.defaultDate !== defaultOccurrenceDate) {
		setOccurrenceSelection({
			defaultDate: defaultOccurrenceDate,
			value: defaultOccurrenceDate ?? "",
		});
	}

	const occurrenceDate = occurrenceSelection.value;

	function confirmOccurrenceCancellation(
		event: React.FormEvent<HTMLFormElement>,
	) {
		if (
			!window.confirm(
				`Cancel "${eventTitle}" on ${formatOccurrenceDate(occurrenceDate)}? All other dates will stay on the calendar.`,
			)
		) {
			event.preventDefault();
		}
	}

	function confirmEventCancellation(event: React.FormEvent<HTMLFormElement>) {
		const description = isRecurring
			? "This will remove the whole series from the calendar, including every future date."
			: "This will remove the event from the calendar.";

		if (!window.confirm(`Cancel "${eventTitle}"? ${description}`)) {
			event.preventDefault();
		}
	}

	return (
		<section
			aria-label={`Cancellation options for ${eventTitle}`}
			className={style.cancellationPanel}
		>
			<div className={style.cancellationHeading}>
				<h4>{isRecurring ? "Manage this series" : "Cancel this event"}</h4>
				<p>
					Your cancellation takes effect right away. It doesn&apos;t need
					another admin review.
				</p>
			</div>

			{isRecurring && (
				<div className={style.occurrenceCancellation}>
					<div>
						<h5>Cancel one date</h5>
						<p>
							Choose a date to remove from the calendar. Every other date stays
							scheduled.
						</p>
					</div>
					{defaultOccurrenceDate ? (
						<form
							action={occurrenceAction}
							aria-busy={occurrencePending}
							onSubmit={confirmOccurrenceCancellation}
						>
							<input name="scope" type="hidden" value="occurrence" />
							<label htmlFor={`occurrence-${eventId}`}>Date to cancel</label>
							<div className={style.occurrenceControls}>
								<input
									disabled={pending}
									id={`occurrence-${eventId}`}
									max={maxOccurrenceDate ?? undefined}
									min={minOccurrenceDate}
									name="occurrenceDate"
									onChange={(event) =>
										setOccurrenceSelection((current) => ({
											...current,
											value: event.target.value,
										}))
									}
									required
									type="date"
									value={occurrenceDate}
								/>
								<button
									className={style.cancelOccurrenceButton}
									disabled={pending}
									type="submit"
								>
									{occurrencePending ? "Canceling…" : "Cancel this date"}
								</button>
							</div>
						</form>
					) : (
						<p className={style.noUpcomingOccurrences}>
							There are no upcoming dates to cancel in this series.
						</p>
					)}
					<div
						aria-atomic="true"
						aria-live="polite"
						className={style.cancellationStatus}
					>
						{occurrenceState.message && (
							<p
								className={
									occurrenceState.status === "success"
										? style.cancelSuccess
										: style.cancelError
								}
								role={occurrenceState.status === "success" ? "status" : "alert"}
							>
								{occurrenceState.message}
							</p>
						)}
					</div>
				</div>
			)}

			<div className={style.eventCancellation}>
				<div>
					<h5>{isRecurring ? "Cancel the whole series" : "Cancel event"}</h5>
					<p>
						{isRecurring
							? "This removes every date in the series from the calendar."
							: "This removes the event from the calendar."}
					</p>
				</div>
				<form
					action={eventAction}
					aria-busy={eventPending}
					onSubmit={confirmEventCancellation}
				>
					<input name="scope" type="hidden" value="event" />
					<button
						className={style.cancelEventButton}
						disabled={pending}
						type="submit"
					>
						{eventPending
							? "Canceling…"
							: isRecurring
								? "Cancel the whole series"
								: "Cancel event"}
					</button>
				</form>
			</div>
			<div
				aria-atomic="true"
				aria-live="polite"
				className={style.cancellationStatus}
			>
				{eventState.message && (
					<p
						className={
							eventState.status === "success"
								? style.cancelSuccess
								: style.cancelError
						}
						role={eventState.status === "success" ? "status" : "alert"}
					>
						{eventState.message}
					</p>
				)}
			</div>
		</section>
	);
}
