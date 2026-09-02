import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { event } from "@/db/schema";
import {
	eventHeaderImageContentType,
	getEventHeaderImage,
} from "@/lib/events/header-image";
import { getCurrentSession, sessionCanReviewEvents } from "@/lib/session";

interface EventImageRouteContext {
	params: Promise<{ eventId: string; imageKey: string }>;
}

function notFound() {
	return new Response("Event image not found", { status: 404 });
}

export async function GET(
	_request: Request,
	{ params }: EventImageRouteContext,
) {
	const parsed = z
		.object({ eventId: z.uuid(), imageKey: z.uuid() })
		.safeParse(await params);

	if (!parsed.success) {
		return notFound();
	}

	const [imageEvent] = await db
		.select({ status: event.status })
		.from(event)
		.where(
			and(
				eq(event.id, parsed.data.eventId),
				eq(event.headerImageKey, parsed.data.imageKey),
				isNull(event.canceledAt),
			),
		)
		.limit(1);

	if (!imageEvent) {
		return notFound();
	}

	if (imageEvent.status !== "approved") {
		const session = await getCurrentSession();

		if (!session || !sessionCanReviewEvents(session)) {
			return notFound();
		}
	}

	const image = await getEventHeaderImage(parsed.data.imageKey);
	const contentType = image
		? eventHeaderImageContentType(image.metadata)
		: null;

	if (!image || !contentType) {
		return notFound();
	}

	const headers = new Headers({
		"Cache-Control":
			imageEvent.status === "approved"
				? "public, max-age=31536000, immutable"
				: "private, no-store",
		"Content-Type": contentType,
		"X-Content-Type-Options": "nosniff",
	});

	if (image.etag) {
		headers.set("ETag", image.etag);
	}

	return new Response(image.data, { headers });
}
