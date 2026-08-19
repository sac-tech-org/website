import type { Metadata } from "next";
import EventsPage from "./events-page";

export const metadata: Metadata = {
	title: "Events | SacTech Community",
	description:
		"Browse online and in-person technology events from the Sacramento tech community.",
};

export default function EventsRoute() {
	return <EventsPage />;
}
