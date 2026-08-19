import type { Event } from "../../types";

export interface RecurringEventsCardProps {
	event: Event;
	referenceDate: string;
}

export interface NonRecurringEventsCardProps {
	event: Event;
}
