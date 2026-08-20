"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitEvent } from "@/lib/events/actions";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import {
	initialEventFormState,
	type EventFormField,
	type EventFormState,
} from "@/lib/events/state";
import { EventDescriptionEditor } from "./event-description-editor";
import style from "./event-form.module.css";

interface FieldErrorsProps {
	errors: EventFormState["errors"];
	field: EventFormField;
}

export type RecurrenceFrequency = "day" | "week" | "month" | "year";
export type RecurrenceMonthlyPattern = "day_of_month" | "nth_weekday";
export type RecurrenceEndType = "never" | "on_date" | "after_occurrences";

export interface EventFormValues {
	description: string;
	endsAt: string;
	eventUrl: string;
	locationAddress: string;
	locationName: string;
	mode: "hybrid" | "in_person" | "online";
	recurrenceCount: string;
	recurrenceEndDate: string;
	recurrenceEndType: RecurrenceEndType;
	recurrenceFrequency: RecurrenceFrequency;
	recurrenceInterval: string;
	recurrenceMonthlyPattern: RecurrenceMonthlyPattern;
	recurrenceWeekdays: number[];
	recurring: boolean;
	startsAt: string;
	title: string;
}

export type EventFormAction = (
	previousState: EventFormState,
	formData: FormData,
) => EventFormState | Promise<EventFormState>;

export interface EventFormProps {
	action?: EventFormAction;
	allowRecurrence?: boolean;
	initialValues?: EventFormValues;
	variant?: "edit" | "submit";
}

interface RecurrenceDraft {
	recurring: boolean;
	interval: string;
	frequency: RecurrenceFrequency;
	weekdays: number[];
	monthlyPattern: RecurrenceMonthlyPattern;
	endType: RecurrenceEndType;
	endDate: string;
	count: string;
}

interface EventDraft {
	description: string;
	endsAt: string;
	eventUrl: string;
	locationAddress: string;
	locationName: string;
	mode: "hybrid" | "in_person" | "online";
	startsAt: string;
	title: string;
}

const WEEKDAYS = [
	{ label: "Sunday", shortLabel: "Sun", value: 0 },
	{ label: "Monday", shortLabel: "Mon", value: 1 },
	{ label: "Tuesday", shortLabel: "Tue", value: 2 },
	{ label: "Wednesday", shortLabel: "Wed", value: 3 },
	{ label: "Thursday", shortLabel: "Thu", value: 4 },
	{ label: "Friday", shortLabel: "Fri", value: 5 },
	{ label: "Saturday", shortLabel: "Sat", value: 6 },
] as const;

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

const INITIAL_RECURRENCE: RecurrenceDraft = {
	count: "10",
	endDate: "",
	endType: "never",
	frequency: "week",
	interval: "1",
	monthlyPattern: "day_of_month",
	recurring: false,
	weekdays: [0],
};

const INITIAL_EVENT_DRAFT: EventDraft = {
	description: "",
	endsAt: "",
	eventUrl: "",
	locationAddress: "",
	locationName: "",
	mode: "in_person",
	startsAt: "",
	title: "",
};

const EMPTY_EVENT_FORM_VALUES: EventFormValues = {
	...INITIAL_EVENT_DRAFT,
	recurrenceCount: INITIAL_RECURRENCE.count,
	recurrenceEndDate: INITIAL_RECURRENCE.endDate,
	recurrenceEndType: INITIAL_RECURRENCE.endType,
	recurrenceFrequency: INITIAL_RECURRENCE.frequency,
	recurrenceInterval: INITIAL_RECURRENCE.interval,
	recurrenceMonthlyPattern: INITIAL_RECURRENCE.monthlyPattern,
	recurrenceWeekdays: INITIAL_RECURRENCE.weekdays,
	recurring: INITIAL_RECURRENCE.recurring,
};

const FORM_COPY = {
	edit: {
		heading: "Update the event details",
		pendingButton: "Submitting changes…",
		review:
			"These changes won't go live right away. A SacTech reviewer must approve them first.",
		stepLabel: "Event edit",
		submitButton: "Submit changes for review",
	},
	submit: {
		heading: "Tell us about the event",
		pendingButton: "Submitting…",
		review:
			"This won't publish the event. It will go to the SacTech review queue.",
		stepLabel: "Event submission",
		submitButton: "Submit event for review",
	},
} as const;

const EVENT_FORM_FIELD_ORDER: EventFormField[] = [
	"title",
	"description",
	"startsAt",
	"endsAt",
	"recurring",
	"recurrenceInterval",
	"recurrenceFrequency",
	"recurrenceWeekdays",
	"recurrenceMonthlyPattern",
	"recurrenceEndType",
	"recurrenceEndDate",
	"recurrenceCount",
	"mode",
	"locationName",
	"locationAddress",
	"eventUrl",
];

function getStartDateParts(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);

	if (!match) {
		return null;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

	return { day, month, weekday, year };
}

function ordinal(value: number) {
	const remainder = value % 100;

	if (remainder >= 11 && remainder <= 13) {
		return `${value}th`;
	}

	switch (value % 10) {
		case 1:
			return `${value}st`;
		case 2:
			return `${value}nd`;
		case 3:
			return `${value}rd`;
		default:
			return `${value}th`;
	}
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

function createEventDraft(values: EventFormValues): EventDraft {
	return {
		description: values.description,
		endsAt: values.endsAt,
		eventUrl: values.eventUrl,
		locationAddress: values.locationAddress,
		locationName: values.locationName,
		mode: values.mode,
		startsAt: values.startsAt,
		title: values.title,
	};
}

function createRecurrenceDraft(values: EventFormValues): RecurrenceDraft {
	return {
		count: values.recurrenceCount,
		endDate: values.recurrenceEndDate,
		endType: values.recurrenceEndType,
		frequency: values.recurrenceFrequency,
		interval: values.recurrenceInterval,
		monthlyPattern: values.recurrenceMonthlyPattern,
		recurring: values.recurring,
		weekdays: [...values.recurrenceWeekdays],
	};
}

export function EventForm({
	action = submitEvent,
	allowRecurrence = true,
	initialValues = EMPTY_EVENT_FORM_VALUES,
	variant = "submit",
}: EventFormProps = {}) {
	const [state, formAction, pending] = useActionState(
		action,
		initialEventFormState,
	);
	const formRef = useRef<HTMLFormElement>(null);
	const initialStartDate = getStartDateParts(initialValues.startsAt);
	const weekdaysCustomized = useRef(
		initialValues.recurring &&
			initialValues.recurrenceFrequency === "week" &&
			initialValues.recurrenceWeekdays.some(
				(weekday) => weekday !== initialStartDate?.weekday,
			),
	);
	const [draft, setDraft] = useState<EventDraft>(() =>
		createEventDraft(initialValues),
	);
	const [recurrence, setRecurrence] = useState<RecurrenceDraft>(() =>
		createRecurrenceDraft(initialValues),
	);
	const [dismissedFeedbackState, setDismissedFeedbackState] =
		useState<EventFormState | null>(null);
	const copy = FORM_COPY[variant];
	const feedbackIsCurrent = dismissedFeedbackState !== state;
	const errors = feedbackIsCurrent ? state.errors : undefined;
	const startsAt = draft.startsAt;
	const startDate = getStartDateParts(startsAt);
	const startWeekday = startDate ? WEEKDAYS[startDate.weekday].label : null;
	const monthlyDayLabel = startDate
		? `Day ${startDate.day} of the month`
		: "Same day of the month";
	const monthlyWeekdayLabel = startDate
		? `The ${ordinal(Math.ceil(startDate.day / 7))} ${startWeekday} of the month`
		: "Same ordinal weekday of the month";
	const yearlyDateLabel = startDate
		? `${MONTHS[startDate.month - 1]} ${startDate.day}`
		: "the event's start month and day";

	function handleStartChange(value: string) {
		const previousStartDate = getStartDateParts(startsAt);
		setDraft((current) => ({ ...current, startsAt: value }));
		const nextStartDate = getStartDateParts(value);
		setRecurrence((current) => ({
			...current,
			weekdays: weekdaysCustomized.current
				? [
						...new Set([
							...current.weekdays.filter(
								(day) => day !== (previousStartDate?.weekday ?? 0),
							),
							nextStartDate?.weekday ?? 0,
						]),
					].sort((first, second) => first - second)
				: [nextStartDate?.weekday ?? 0],
		}));
	}

	function toggleWeekday(day: number, checked: boolean) {
		if (!checked && day === (startDate?.weekday ?? 0)) {
			return;
		}

		weekdaysCustomized.current = true;
		setRecurrence((current) => {
			if (checked) {
				return {
					...current,
					weekdays: [...new Set([...current.weekdays, day])].sort(
						(first, second) => first - second,
					),
				};
			}

			if (current.weekdays.length === 1) {
				return current;
			}

			return {
				...current,
				weekdays: current.weekdays.filter((weekday) => weekday !== day),
			};
		});
	}

	function dismissFeedback() {
		if (state.status !== "idle") {
			setDismissedFeedbackState(state);
		}
	}

	function handleDescriptionChange(description: string) {
		dismissFeedback();
		setDraft((current) => ({ ...current, description }));
	}

	// All user-entered fields are controlled because React resets native form
	// controls after any resolved action, including returned validation errors.
	useEffect(() => {
		if (state.status === "idle") {
			return;
		}

		if (state.status === "success" && variant === "submit") {
			weekdaysCustomized.current = false;
			// These controlled drafts intentionally clear only after the Server Action
			// confirms success, never after a returned error.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setDraft(INITIAL_EVENT_DRAFT);
			setRecurrence(INITIAL_RECURRENCE);
			return;
		}

		// React resets the native form after the action-state render. Reapply the
		// controlled drafts on the next frame so errors and successful edits cannot
		// leave radios or checkboxes at their native defaults.
		const animationFrame = requestAnimationFrame(() => {
			setDraft((current) => ({ ...current }));
			setRecurrence((current) => ({
				...current,
				weekdays: [...current.weekdays],
			}));

			if (state.status !== "error") {
				return;
			}

			const firstInvalidField = EVENT_FORM_FIELD_ORDER.find(
				(field) =>
					(allowRecurrence ||
						(field !== "recurring" && !field.startsWith("recurrence"))) &&
					state.errors?.[field]?.length,
			);
			const firstInvalidControl = firstInvalidField
				? (formRef.current?.querySelector<HTMLElement>(
						`[data-form-field="${firstInvalidField}"]`,
					) ??
					formRef.current?.querySelector<HTMLElement>(
						`[name="${firstInvalidField}"]`,
					))
				: null;

			if (firstInvalidControl && !firstInvalidControl.matches(":disabled")) {
				firstInvalidControl.focus();
			}
		});

		return () => cancelAnimationFrame(animationFrame);
	}, [allowRecurrence, state, variant]);

	return (
		<form
			action={formAction}
			aria-busy={pending}
			className={style.form}
			onChange={dismissFeedback}
			onSubmit={dismissFeedback}
			ref={formRef}
		>
			<div className={style.formHeading}>
				<p className={style.stepLabel}>{copy.stepLabel}</p>
				<h2>{copy.heading}</h2>
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
					disabled={pending}
					id="title"
					maxLength={160}
					minLength={3}
					name="title"
					onChange={(event) =>
						setDraft((current) => ({
							...current,
							title: event.target.value,
						}))
					}
					required
					type="text"
					value={draft.title}
				/>
				<p className={style.hint} id="title-hint">
					Use the event name attendees will see.
				</p>
				<FieldErrors errors={errors} field="title" />
			</div>

			<div className={style.field}>
				<label htmlFor="description" id="description-label">
					Description <span aria-hidden="true">*</span>
				</label>
				<EventDescriptionEditor
					aria-describedby={describedBy(
						"description",
						"description-hint",
						errors,
					)}
					aria-invalid={errors?.description?.length ? true : undefined}
					disabled={pending}
					onChange={handleDescriptionChange}
					value={draft.description}
				/>
				<p className={style.hint} id="description-hint">
					Tell people what will happen, who the event is for, and what they
					should bring or know.
				</p>
				<FieldErrors errors={errors} field="description" />
			</div>

			<fieldset className={style.fieldGroup} disabled={pending}>
				<legend>When it happens</legend>
				<p className={style.groupHint} id="time-zone-hint">
					Use Pacific time ({SACRAMENTO_TIME_ZONE}) for both. We&apos;ll apply
					PST or PDT based on the event date.
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
							onChange={(event) => handleStartChange(event.target.value)}
							required
							step={60}
							type="datetime-local"
							value={startsAt}
						/>
						<FieldErrors errors={errors} field="startsAt" />
					</div>
					<div className={style.field}>
						<label htmlFor="endsAt">
							Ends <span aria-hidden="true">*</span>
						</label>
						<input
							aria-describedby={describedBy("endsAt", "time-zone-hint", errors)}
							aria-invalid={errors?.endsAt?.length ? true : undefined}
							id="endsAt"
							name="endsAt"
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									endsAt: event.target.value,
								}))
							}
							required
							step={60}
							type="datetime-local"
							value={draft.endsAt}
						/>
						<FieldErrors errors={errors} field="endsAt" />
					</div>
				</div>
			</fieldset>

			<fieldset
				className={`${style.fieldGroup} ${style.recurrenceGroup}`}
				disabled={pending || !allowRecurrence}
				hidden={!allowRecurrence}
			>
				<legend>Does it repeat?</legend>
				<label className={style.recurringToggle}>
					<input
						aria-describedby={describedBy(
							"recurring",
							"recurring-hint",
							errors,
						)}
						checked={recurrence.recurring}
						name="recurring"
						onChange={(event) =>
							setRecurrence((current) => ({
								...current,
								recurring: event.target.checked,
							}))
						}
						type="checkbox"
						value="on"
					/>
					<span>
						<strong>This event repeats</strong>
						<small>Choose a daily, weekly, monthly, or yearly schedule.</small>
					</span>
				</label>
				<p className={style.groupHint} id="recurring-hint">
					Leave this off for a one-time event.
				</p>
				<FieldErrors errors={errors} field="recurring" />

				{recurrence.recurring && (
					<div className={style.recurrencePanel}>
						<div className={style.repeatEvery}>
							<label htmlFor="recurrenceInterval">Repeat every</label>
							<input
								aria-describedby={describedBy(
									"recurrenceInterval",
									"repeat-every-hint",
									errors,
								)}
								aria-invalid={
									errors?.recurrenceInterval?.length ? true : undefined
								}
								id="recurrenceInterval"
								inputMode="numeric"
								max={99}
								min={1}
								name="recurrenceInterval"
								onChange={(event) =>
									setRecurrence((current) => ({
										...current,
										interval: event.target.value,
									}))
								}
								required
								type="number"
								value={recurrence.interval}
							/>
							<label className="visuallyHidden" htmlFor="recurrenceFrequency">
								Recurrence unit
							</label>
							<select
								aria-describedby={describedBy(
									"recurrenceFrequency",
									"repeat-every-hint",
									errors,
								)}
								aria-invalid={
									errors?.recurrenceFrequency?.length ? true : undefined
								}
								id="recurrenceFrequency"
								name="recurrenceFrequency"
								onChange={(event) => {
									const frequency = event.target.value as RecurrenceFrequency;
									setRecurrence((current) => ({
										...current,
										frequency,
										weekdays:
											frequency === "week" && !weekdaysCustomized.current
												? [startDate?.weekday ?? 0]
												: current.weekdays,
									}));
								}}
								required
								value={recurrence.frequency}
							>
								<option value="day">
									{recurrence.interval === "1" ? "day" : "days"}
								</option>
								<option value="week">
									{recurrence.interval === "1" ? "week" : "weeks"}
								</option>
								<option value="month">
									{recurrence.interval === "1" ? "month" : "months"}
								</option>
								<option value="year">
									{recurrence.interval === "1" ? "year" : "years"}
								</option>
							</select>
						</div>
						<p className={style.hint} id="repeat-every-hint">
							Choose how often the event repeats.
						</p>
						<FieldErrors errors={errors} field="recurrenceInterval" />
						<FieldErrors errors={errors} field="recurrenceFrequency" />

						{recurrence.frequency === "week" && (
							<fieldset
								aria-describedby={describedBy(
									"recurrenceWeekdays",
									"weekdays-hint",
									errors,
								)}
								className={style.weekdayGroup}
							>
								<legend>
									Repeat on <span aria-hidden="true">*</span>
								</legend>
								<p className={style.hint} id="weekdays-hint">
									The event&apos;s start day is selected automatically and
									can&apos;t be removed. Add any other days when it also
									happens.
								</p>
								<div className={style.weekdayOptions}>
									{WEEKDAYS.map((day) => (
										<label className={style.weekdayOption} key={day.value}>
											<input
												checked={recurrence.weekdays.includes(day.value)}
												name="recurrenceWeekdays"
												onChange={(event) =>
													toggleWeekday(day.value, event.target.checked)
												}
												type="checkbox"
												value={day.value}
											/>
											<span aria-hidden="true">{day.shortLabel}</span>
											<span className="visuallyHidden">{day.label}</span>
										</label>
									))}
								</div>
								<FieldErrors errors={errors} field="recurrenceWeekdays" />
							</fieldset>
						)}

						{recurrence.frequency === "month" && (
							<div className={style.field}>
								<label htmlFor="recurrenceMonthlyPattern">
									Monthly pattern
								</label>
								<select
									aria-describedby={describedBy(
										"recurrenceMonthlyPattern",
										"monthly-pattern-hint",
										errors,
									)}
									aria-invalid={
										errors?.recurrenceMonthlyPattern?.length ? true : undefined
									}
									id="recurrenceMonthlyPattern"
									name="recurrenceMonthlyPattern"
									onChange={(event) =>
										setRecurrence((current) => ({
											...current,
											monthlyPattern: event.target
												.value as RecurrenceMonthlyPattern,
										}))
									}
									required
									value={recurrence.monthlyPattern}
								>
									<option value="day_of_month">{monthlyDayLabel}</option>
									<option value="nth_weekday">{monthlyWeekdayLabel}</option>
								</select>
								<p className={style.hint} id="monthly-pattern-hint">
									We calculate this pattern from the event&apos;s Pacific start
									date.
								</p>
								<FieldErrors errors={errors} field="recurrenceMonthlyPattern" />
							</div>
						)}

						{recurrence.frequency === "day" && (
							<p className={style.frequencyNote}>
								The event starts at the same Pacific time each time it repeats.
							</p>
						)}

						{recurrence.frequency === "year" && (
							<p className={style.frequencyNote}>
								The event repeats every {recurrence.interval}{" "}
								{recurrence.interval === "1" ? "year" : "years"} on{" "}
								<strong>{yearlyDateLabel}</strong> at the same Pacific time.
							</p>
						)}

						<p className={style.timezoneNotice}>
							<strong>The whole series stays on Pacific time.</strong> We use{" "}
							{SACRAMENTO_TIME_ZONE} and apply PST or PDT based on each date.
						</p>

						<fieldset
							aria-describedby={describedBy(
								"recurrenceEndType",
								"recurrence-end-hint",
								errors,
							)}
							className={style.endGroup}
						>
							<legend>Ends</legend>
							<p className={style.hint} id="recurrence-end-hint">
								Choose when this series ends.
							</p>
							<div className={style.endOptions}>
								<div className={style.endOption}>
									<label>
										<input
											checked={recurrence.endType === "never"}
											name="recurrenceEndType"
											onChange={() =>
												setRecurrence((current) => ({
													...current,
													endType: "never",
												}))
											}
											required
											type="radio"
											value="never"
										/>
										<span>Never</span>
									</label>
								</div>
								<div className={style.endOption}>
									<label>
										<input
											checked={recurrence.endType === "on_date"}
											name="recurrenceEndType"
											onChange={() =>
												setRecurrence((current) => ({
													...current,
													endType: "on_date",
												}))
											}
											required
											type="radio"
											value="on_date"
										/>
										<span>On date</span>
									</label>
									<label className="visuallyHidden" htmlFor="recurrenceEndDate">
										Recurrence end date
									</label>
									<input
										aria-describedby={describedBy(
											"recurrenceEndDate",
											"recurrence-end-hint",
											errors,
										)}
										aria-invalid={
											errors?.recurrenceEndDate?.length ? true : undefined
										}
										disabled={recurrence.endType !== "on_date"}
										id="recurrenceEndDate"
										min={startsAt ? startsAt.slice(0, 10) : undefined}
										name="recurrenceEndDate"
										onChange={(event) =>
											setRecurrence((current) => ({
												...current,
												endDate: event.target.value,
											}))
										}
										required={recurrence.endType === "on_date"}
										type="date"
										value={recurrence.endDate}
									/>
								</div>
								<div className={style.endOption}>
									<label>
										<input
											checked={recurrence.endType === "after_occurrences"}
											name="recurrenceEndType"
											onChange={() =>
												setRecurrence((current) => ({
													...current,
													endType: "after_occurrences",
												}))
											}
											required
											type="radio"
											value="after_occurrences"
										/>
										<span>After</span>
									</label>
									<label className="visuallyHidden" htmlFor="recurrenceCount">
										Number of occurrences
									</label>
									<input
										aria-describedby={describedBy(
											"recurrenceCount",
											"recurrence-end-hint",
											errors,
										)}
										aria-invalid={
											errors?.recurrenceCount?.length ? true : undefined
										}
										disabled={recurrence.endType !== "after_occurrences"}
										id="recurrenceCount"
										inputMode="numeric"
										max={1_000}
										min={2}
										name="recurrenceCount"
										onChange={(event) =>
											setRecurrence((current) => ({
												...current,
												count: event.target.value,
											}))
										}
										required={recurrence.endType === "after_occurrences"}
										type="number"
										value={recurrence.count}
									/>
									<span>occurrences</span>
								</div>
							</div>
							<FieldErrors errors={errors} field="recurrenceEndType" />
							<FieldErrors errors={errors} field="recurrenceEndDate" />
							<FieldErrors errors={errors} field="recurrenceCount" />
						</fieldset>
					</div>
				)}
			</fieldset>

			<fieldset
				aria-describedby={describedBy("mode", "mode-hint", errors)}
				className={style.fieldGroup}
				disabled={pending}
			>
				<legend>
					How people attend <span aria-hidden="true">*</span>
				</legend>
				<p className={style.groupHint} id="mode-hint">
					Choose the option that covers every way people can attend.
				</p>
				<div className={style.modeOptions}>
					<label className={style.modeOption}>
						<input
							checked={draft.mode === "in_person"}
							name="mode"
							onChange={() =>
								setDraft((current) => ({
									...current,
									mode: "in_person",
								}))
							}
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
							checked={draft.mode === "online"}
							name="mode"
							onChange={() =>
								setDraft((current) => ({
									...current,
									mode: "online",
								}))
							}
							required
							type="radio"
							value="online"
						/>
						<span>
							<strong>Online</strong>
							<small>Through a link</small>
						</span>
					</label>
					<label className={style.modeOption}>
						<input
							checked={draft.mode === "hybrid"}
							name="mode"
							onChange={() =>
								setDraft((current) => ({
									...current,
									mode: "hybrid",
								}))
							}
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

			<fieldset className={style.fieldGroup} disabled={pending}>
				<legend>Where people attend</legend>
				<p className={style.groupHint}>
					In-person and hybrid events need a location name. Online and hybrid
					events need an event link.
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
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								locationName: event.target.value,
							}))
						}
						type="text"
						value={draft.locationName}
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
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								locationAddress: event.target.value,
							}))
						}
						type="text"
						value={draft.locationAddress}
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
						aria-describedby={describedBy("eventUrl", "event-url-hint", errors)}
						aria-invalid={errors?.eventUrl?.length ? true : undefined}
						id="eventUrl"
						inputMode="url"
						maxLength={2_048}
						name="eventUrl"
						onChange={(event) =>
							setDraft((current) => ({
								...current,
								eventUrl: event.target.value,
							}))
						}
						placeholder="https://"
						type="url"
						value={draft.eventUrl}
					/>
					<p className={style.hint} id="event-url-hint">
						Link to a public page where people can join or learn more. Use
						http:// or https://.
					</p>
					<FieldErrors errors={errors} field="eventUrl" />
				</div>
			</fieldset>

			{feedbackIsCurrent && state.message && (
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
					{pending ? copy.pendingButton : copy.submitButton}
					<span aria-hidden="true">→</span>
				</button>
				<p>{copy.review}</p>
			</div>
		</form>
	);
}
