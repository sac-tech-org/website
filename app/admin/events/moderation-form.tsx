"use client";

import { useActionState } from "react";
import { moderateEvent } from "@/lib/events/actions";
import { initialModerationFormState } from "@/lib/events/state";
import style from "./admin-events.module.css";

interface ModerationFormProps {
	eventId: string;
	eventTitle: string;
}

export function ModerationForm({ eventId, eventTitle }: ModerationFormProps) {
	const moderateBoundEvent = moderateEvent.bind(null, eventId);
	const [state, formAction, pending] = useActionState(
		moderateBoundEvent,
		initialModerationFormState,
	);
	const noteId = `moderation-${eventId}-note`;
	const noteHintId = `${noteId}-hint`;

	return (
		<form
			action={formAction}
			aria-label={`Review ${eventTitle}`}
			className={style.moderationForm}
		>
			<div className={style.moderationHeading}>
				<h4>Review decision</h4>
				<p>Approval publishes this event to the calendar.</p>
			</div>

			<div className={style.noteField}>
				<label htmlFor={noteId}>Note to submitter (optional)</label>
				<textarea
					aria-describedby={noteHintId}
					disabled={pending}
					id={noteId}
					maxLength={500}
					name="note"
					rows={3}
				/>
				<p id={noteHintId}>
					A rejection requires a note of at least 5 characters so the
					submitter knows what to change.
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
					{pending ? "Saving…" : "Approve and publish"}
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
