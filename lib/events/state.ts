export type EventFormField =
	| "title"
	| "description"
	| "startsAt"
	| "endsAt"
	| "mode"
	| "locationName"
	| "locationAddress"
	| "eventUrl"
	| "recurring"
	| "recurrenceInterval"
	| "recurrenceFrequency"
	| "recurrenceWeekdays"
	| "recurrenceMonthlyPattern"
	| "recurrenceEndType"
	| "recurrenceEndDate"
	| "recurrenceCount";

export interface EventFormState {
	status: "idle" | "error" | "success";
	message: string;
	errors?: Partial<Record<EventFormField, string[]>>;
}

export interface ModerationFormState {
	status: "idle" | "error" | "success";
	message: string;
}

export interface CancellationFormState {
	status: "idle" | "error" | "success";
	message: string;
}

export interface CollaboratorFormState {
	status: "idle" | "error" | "success";
	message: string;
}

export const initialEventFormState: EventFormState = {
	status: "idle",
	message: "",
};

export const initialModerationFormState: ModerationFormState = {
	status: "idle",
	message: "",
};

export const initialCancellationFormState: CancellationFormState = {
	status: "idle",
	message: "",
};

export const initialCollaboratorFormState: CollaboratorFormState = {
	status: "idle",
	message: "",
};
