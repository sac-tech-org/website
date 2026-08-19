import type { Metadata } from "next";
import { connection } from "next/server";
import { SACRAMENTO_TIME_ZONE } from "@/lib/events/constants";
import { getApprovedEvents } from "@/lib/events/queries";
import { formatDateKey } from "./date-utils";
import EventsPage from "./events-page";

export const metadata: Metadata = {
	title: "Events",
	description:
		"Browse approved Sacramento technology events and check back as more dates are confirmed.",
};

export default async function EventsRoute() {
	await connection();

	const currentSacramentoDate = formatDateKey(new Date(), SACRAMENTO_TIME_ZONE);
	const events = await getApprovedEvents();

	return <EventsPage events={events} referenceDate={currentSacramentoDate} />;
}
