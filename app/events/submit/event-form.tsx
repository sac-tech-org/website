"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitEvent } from "@/lib/events/actions";
import {
	initialEventFormState,
	type EventFormField,
	type EventFormState,
} from "@/lib/events/state";
import style from "./event-form.module.css";

interface FieldErrorsProps {
	errors: EventFormState["errors"];
	field: EventFormField;
}

function errorId(field: EventFormField) {
	return `${field}-error`;
}

function describedBy(
	field: EventFormField,
	hintId: string,
	errors: EventFormState["errors"],
) {
	return errors?.[field]?.length ? `${hintId} ${errorId(field)}` : hintId;
}

function FieldErrors({ errors, field }: FieldErrorsProps) {
	const messages = errors?.[field];

	if (!messages?.length) {
		return null;
	}

	return (
		<div className={style.fieldErrors} id={errorId(field)}>
			{messages.map((message, index) => (
				<p key={`${message}-${index}`}>{message}</p>
			))}
		</div>
	);
}

export function EventForm() {
	const [state, formAction, pending] = useActionState(
		submitEvent,
		initialEventFormState,
	);
	const formRef = useRef<HTMLFormElement>(null);
	const allowSuccessfulReset = useRef(false);
	const errors = state.errors;

	// React resets uncontrolled fields after any resolved action, including validation errors.
	useEffect(() => {
		if (state.status !== "success" || !formRef.current) {
			return;
		}

		allowSuccessfulReset.current = true;
		formRef.current.reset();
		allowSuccessfulReset.current = false;
	}, [state]);

	return (
		<form
			action={formAction}
			className={style.form}
			onReset={(event) => {
				if (!allowSuccessfulReset.current) {
					event.preventDefault();
				}
			}}
			ref={formRef}
		>
			<div className={style.formHeading}>
				<p className={style.stepLabel}>Event submission</p>
				<h2>What should the community know?</h2>
				<p>
					Fields marked <span aria-hidden="true">*</span> are required.
				</p>
			</div>

			<div className={style.field}>
				<label htmlFor="title">
					Event title <span aria-hidden="true">*</span>
				</label>
				<input
					aria-describedby={describedBy("title", "title-hint", errors)}
					aria-invalid={errors?.title?.length ? true : undefined}
					id="title"
					maxLength={160}
					minLength={3}
					name="title"
					required
					type="text"
				/>
				<p className={style.hint} id="title-hint">
					Use the name attendees will recognize.
				</p>
				<FieldErrors errors={errors} field="title" />
			</div>

			<div className={style.field}>
				<label htmlFor="description">
					Description <span aria-hidden="true">*</span>
				</label>
				<textarea
					aria-describedby={describedBy(
						"description",
						"description-hint",
						errors,
					)}
					aria-invalid={errors?.description?.length ? true : undefined}
					id="description"
					maxLength={4_000}
					minLength={20}
					name="description"
					required
					rows={7}
				/>
				<p className={style.hint} id="description-hint">
					Share what people will do, who the event is for, and anything
					they should bring or know.
				</p>
				<FieldErrors errors={errors} field="description" />
			</div>

			<fieldset className={style.fieldGroup}>
				<legend>When it happens</legend>
				<p className={style.groupHint} id="time-zone-hint">
					Enter both times in Pacific time (America/Los_Angeles).
				</p>
				<div className={style.twoColumns}>
					<div className={style.field}>
						<label htmlFor="startsAt">
							Starts <span aria-hidden="true">*</span>
						</label>
						<input
							aria-describedby={describedBy(
								"startsAt",
								"time-zone-hint",
								errors,
							)}
							aria-invalid={errors?.startsAt?.length ? true : undefined}
							id="startsAt"
							name="startsAt"
							required
							step={60}
							type="datetime-local"
						/>
						<FieldErrors errors={errors} field="startsAt" />
					</div>
					<div className={style.field}>
						<label htmlFor="endsAt">
							Ends <span aria-hidden="true">*</span>
						</label>
						<input
							aria-describedby={describedBy(
								"endsAt",
								"time-zone-hint",
								errors,
							)}
							aria-invalid={errors?.endsAt?.length ? true : undefined}
							id="endsAt"
							name="endsAt"
							required
							step={60}
							type="datetime-local"
						/>
						<FieldErrors errors={errors} field="endsAt" />
					</div>
				</div>
			</fieldset>

			<fieldset
				aria-describedby={describedBy("mode", "mode-hint", errors)}
				className={style.fieldGroup}
			>
				<legend>
					How people attend <span aria-hidden="true">*</span>
				</legend>
				<p className={style.groupHint} id="mode-hint">
					Choose the option that describes the complete event.
				</p>
				<div className={style.modeOptions}>
					<label className={style.modeOption}>
						<input
							defaultChecked
							name="mode"
							required
							type="radio"
							value="in_person"
						/>
						<span>
							<strong>In person</strong>
							<small>At a physical venue</small>
						</span>
					</label>
					<label className={style.modeOption}>
						<input
							name="mode"
							required
							type="radio"
							value="online"
						/>
						<span>
							<strong>Online</strong>
							<small>Joined through a link</small>
						</span>
					</label>
					<label className={style.modeOption}>
						<input
							name="mode"
							required
							type="radio"
							value="hybrid"
						/>
						<span>
							<strong>Hybrid</strong>
							<small>In person and online</small>
						</span>
					</label>
				</div>
				<FieldErrors errors={errors} field="mode" />
			</fieldset>

			<fieldset className={style.fieldGroup}>
				<legend>Where people attend</legend>
				<p className={style.groupHint}>
					A location name is required for in-person and hybrid events. An
					event link is required for online and hybrid events.
				</p>
				<div className={style.field}>
					<label htmlFor="locationName">Venue or location name</label>
					<input
						aria-describedby={describedBy(
							"locationName",
							"location-name-hint",
							errors,
						)}
						aria-invalid={errors?.locationName?.length ? true : undefined}
						id="locationName"
						maxLength={200}
						name="locationName"
						type="text"
					/>
					<p className={style.hint} id="location-name-hint">
						For example, a coworking space, library, or community center.
					</p>
					<FieldErrors errors={errors} field="locationName" />
				</div>

				<div className={style.field}>
					<label htmlFor="locationAddress">Street address</label>
					<input
						aria-describedby={describedBy(
							"locationAddress",
							"location-address-hint",
							errors,
						)}
						aria-invalid={errors?.locationAddress?.length ? true : undefined}
						id="locationAddress"
						maxLength={500}
						name="locationAddress"
						type="text"
					/>
					<p className={style.hint} id="location-address-hint">
						Optional. Include the city and postal code when they help people
						find the venue.
					</p>
					<FieldErrors errors={errors} field="locationAddress" />
				</div>

				<div className={style.field}>
					<label htmlFor="eventUrl">Event or registration link</label>
					<input
						aria-describedby={describedBy(
							"eventUrl",
							"event-url-hint",
							errors,
						)}
						aria-invalid={errors?.eventUrl?.length ? true : undefined}
						id="eventUrl"
						inputMode="url"
						maxLength={2_048}
						name="eventUrl"
						placeholder="https://"
						type="url"
					/>
					<p className={style.hint} id="event-url-hint">
						Use a public http:// or https:// link where attendees can join
						or learn more.
					</p>
					<FieldErrors errors={errors} field="eventUrl" />
				</div>
			</fieldset>

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

			<div className={style.submitArea}>
				<button disabled={pending} type="submit">
					{pending ? "Submitting…" : "Submit event for review"}
					<span aria-hidden="true">→</span>
				</button>
				<p>
					Submitting does not publish the event. It sends it to the SacTech
					review queue.
				</p>
			</div>
		</form>
	);
}
