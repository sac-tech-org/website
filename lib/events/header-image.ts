import "server-only";
import { getStore } from "@netlify/blobs";
import {
	EVENT_HEADER_IMAGE_TYPES,
	type EventHeaderImageType,
} from "@/lib/events/header-image-constraints";

const EVENT_HEADER_IMAGE_STORE = "event-header-images";

interface EventHeaderImageMetadata {
	contentType: EventHeaderImageType;
	uploadedAt: string;
}

export class InvalidEventHeaderImageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidEventHeaderImageError";
	}
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
	return prefix.every((byte, index) => bytes[index] === byte);
}

async function hasValidImageSignature(file: File) {
	const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());

	switch (file.type) {
		case "image/jpeg":
			return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
		case "image/png":
			return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		case "image/webp":
			return (
				hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
				bytes[8] === 0x57 &&
				bytes[9] === 0x45 &&
				bytes[10] === 0x42 &&
				bytes[11] === 0x50
			);
		case "image/avif":
			if (!hasPrefix(bytes.slice(4), [0x66, 0x74, 0x79, 0x70])) {
				return false;
			}

			for (let index = 8; index + 3 < bytes.length; index += 4) {
				if (
					bytes[index] === 0x61 &&
					bytes[index + 1] === 0x76 &&
					bytes[index + 2] === 0x69 &&
					(bytes[index + 3] === 0x66 || bytes[index + 3] === 0x73)
				) {
					return true;
				}
			}

			return false;
		default:
			return false;
	}
}

function eventHeaderImageStore() {
	return getStore(EVENT_HEADER_IMAGE_STORE);
}

export async function uploadEventHeaderImage(file: File) {
	if (!(await hasValidImageSignature(file))) {
		throw new InvalidEventHeaderImageError(
			"Choose a valid AVIF, JPEG, PNG, or WebP image.",
		);
	}

	const key = crypto.randomUUID();
	const result = await eventHeaderImageStore().set(key, file, {
		metadata: {
			contentType: file.type as EventHeaderImageType,
			uploadedAt: new Date().toISOString(),
		} satisfies EventHeaderImageMetadata,
		onlyIfNew: true,
	});

	if (!result.modified) {
		throw new Error("The event header image key already exists.");
	}

	return key;
}

export async function deleteEventHeaderImage(key: string) {
	await eventHeaderImageStore().delete(key);
}

export async function getEventHeaderImage(key: string) {
	return eventHeaderImageStore().getWithMetadata(key, { type: "stream" });
}

export function eventHeaderImageContentType(
	metadata: Record<string, unknown>,
): EventHeaderImageType | null {
	const { contentType } = metadata;

	return typeof contentType === "string" &&
		EVENT_HEADER_IMAGE_TYPES.includes(contentType as EventHeaderImageType)
		? (contentType as EventHeaderImageType)
		: null;
}
