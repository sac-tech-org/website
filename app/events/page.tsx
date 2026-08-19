import type { Metadata } from "next";
import { connection } from "next/server";
import { formatDateKey } from "./date-utils";
import EventsPage from "./events-page";

export const metadata: Metadata = {
	title: "Events",
	description:
		"Explore the SacTech community calendar while the next verified Sacramento technology events are confirmed.",
};

export default async function EventsRoute() {
	await connection();

	const currentSacramentoDate = formatDateKey(
		new Date(),
		"America/Los_Angeles",
	);

	return <EventsPage referenceDate={currentSacramentoDate} />;
}
