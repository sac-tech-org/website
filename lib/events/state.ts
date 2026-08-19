export type EventFormField =
	| "title"
	| "description"
	| "startsAt"
	| "endsAt"
	| "mode"
	| "locationName"
	| "locationAddress"
	| "eventUrl";

export interface EventFormState {
	status: "idle" | "error" | "success";
	message: string;
	errors?: Partial<Record<EventFormField, string[]>>;
}

export interface ModerationFormState {
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
