"use client";

import { useActionState, useEffect, useState } from "react";
import { inviteEventCollaborator } from "@/lib/events/actions";
import { initialCollaboratorFormState } from "@/lib/events/state";
import style from "./edit-event.module.css";

interface CollaboratorInviteFormProps {
	eventId: string;
}

export function CollaboratorInviteForm({
	eventId,
}: CollaboratorInviteFormProps) {
	const inviteForEvent = inviteEventCollaborator.bind(null, eventId);
	const [state, formAction, pending] = useActionState(
		inviteForEvent,
		initialCollaboratorFormState,
	);
	const [email, setEmail] = useState("");

	useEffect(() => {
		if (state.status === "success") {
			// Clear only after the invitation is stored, not after a returned error.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setEmail("");
		}
	}, [state]);

	return (
		<form action={formAction} className={style.inviteForm}>
			<label htmlFor={`collaborator-email-${eventId}`}>Account email</label>
			<div className={style.inviteControls}>
				<input
					autoComplete="email"
					disabled={pending}
					id={`collaborator-email-${eventId}`}
					maxLength={320}
					name="email"
					onChange={(event) => setEmail(event.target.value)}
					placeholder="person@example.com"
					required
					type="email"
					value={email}
				/>
				<button disabled={pending} type="submit">
					{pending ? "Inviting…" : "Invite editor"}
				</button>
			</div>
			{state.message && (
				<p
					className={
						state.status === "success" ? style.inviteSuccess : style.inviteError
					}
					role={state.status === "success" ? "status" : "alert"}
				>
					{state.message}
				</p>
			)}
		</form>
	);
}
