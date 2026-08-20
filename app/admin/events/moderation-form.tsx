"use client";

import { useActionState, useEffect, useState } from "react";
import { moderateEvent, moderateEventEdit } from "@/lib/events/actions";
import { initialModerationFormState } from "@/lib/events/state";
import style from "./admin-events.module.css";

interface ModerationFormProps {
	eventId: string;
	eventTitle: string;
	reviewType?: "event" | "edit";
}

export function ModerationForm({
	eventId,
	eventTitle,
	reviewType = "event",
}: ModerationFormProps) {
	const [note, setNote] = useState("");
	const moderationAction =
		reviewType === "edit" ? moderateEventEdit : moderateEvent;
	const moderateBoundEvent = moderationAction.bind(null, eventId);
	const [state, formAction, pending] = useActionState(
		moderateBoundEvent,
		initialModerationFormState,
	);
	const noteId = `moderation-${eventId}-note`;
	const noteHintId = `${noteId}-hint`;

	useEffect(() => {
		if (state.status === "success") {
			// The Server Action resets native controls after every result. This
			// controlled value intentionally clears only after a saved decision.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setNote("");
		}
	}, [state]);

	return (
		<form
			action={formAction}
			aria-label={`Review ${eventTitle}`}
			className={style.moderationForm}
		>
			<div className={style.moderationHeading}>
				<h4>Approve or reject</h4>
				<p>
					{reviewType === "edit"
						? "Approving replaces the live details with this proposed change."
						: "Approving publishes this event to the calendar."}
				</p>
			</div>

			<div className={style.noteField}>
				<label htmlFor={noteId}>Note to submitter (optional)</label>
				<textarea
					aria-describedby={noteHintId}
					disabled={pending}
					id={noteId}
					maxLength={500}
					name="note"
					onChange={(event) => setNote(event.target.value)}
					rows={3}
					value={note}
				/>
				<p id={noteHintId}>
					A note is optional when you approve. If you reject, write at least 5
					characters so the submitter knows what to change.
				</p>
			</div>

			{state.message && (
				<p
					aria-atomic="true"
					className={
						state.status === "success"
							? style.successMessage
							: style.errorMessage
					}
					role={state.status === "success" ? "status" : "alert"}
				>
					{state.message}
				</p>
			)}

			<div className={style.buttonRow}>
				<button
					className={style.approveButton}
					disabled={pending}
					name="decision"
					type="submit"
					value="approved"
				>
					{pending
						? "Saving…"
						: reviewType === "edit"
							? "Approve changes"
							: "Approve and publish"}
				</button>
				<button
					className={style.rejectButton}
					disabled={pending}
					name="decision"
					type="submit"
					value="rejected"
				>
					{pending ? "Saving…" : "Reject with note"}
				</button>
			</div>
		</form>
	);
}
