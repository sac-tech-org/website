export const EVENT_HEADER_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export const EVENT_HEADER_IMAGE_TYPES = [
	"image/avif",
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export type EventHeaderImageType = (typeof EVENT_HEADER_IMAGE_TYPES)[number];

export const EVENT_HEADER_IMAGE_ACCEPT = EVENT_HEADER_IMAGE_TYPES.join(",");

export function eventHeaderImagePath(eventId: string, imageKey: string) {
	return `/event-images/${eventId}/${imageKey}`;
}
