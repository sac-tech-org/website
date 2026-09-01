import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/session";
import { EventForm } from "./event-form";
import style from "./event-form.module.css";

export const metadata: Metadata = {
	title: "Submit an event",
	description:
		"Submit a Sacramento technology event to the SacTech community calendar.",
};

async function AuthenticatedEventForm() {
	await requireSession();

	return <EventForm />;
}

function EventFormFallback() {
	return (
		<div aria-busy="true" className={style.formHeading} role="status">
			<p className={style.stepLabel}>Event submission</p>
			<h2>Tell us about the event</h2>
			<p>Checking your account and preparing the event form.</p>
		</div>
	);
}

export default function SubmitEventPage() {
	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="page-title" className={style.hero}>
				<div className={style.heroInner}>
					<p className={style.eyebrow}>Community calendar</p>
					<h1 id="page-title">Tell Sacramento about your event.</h1>
					<p>
						Tell us what&apos;s happening, when it starts, and how people can
						join. A SacTech reviewer will check it before it appears on the
						public calendar.
					</p>
				</div>
			</section>

			<section aria-labelledby="form-title" className={style.content}>
				<div className={style.layout}>
					<aside className={style.guide}>
						<p className={style.guideEyebrow}>Before you submit</p>
						<h2 id="form-title">Give us the details we need.</h2>
						<ul>
							<li>Use the title and description that attendees will see.</li>
							<li>
								Enter the start and end times in Pacific time. We&apos;ll handle
								daylight saving time automatically.
							</li>
							<li>
								For in-person events, include a venue. For online events,
								include a link.
							</li>
						</ul>
						<p className={style.reviewNote}>
							<strong>We mark every new event as pending.</strong> A SacTech
							reviewer must approve it before it&apos;s published.
						</p>
					</aside>

					<div className={style.formCard}>
						<Suspense fallback={<EventFormFallback />}>
							<AuthenticatedEventForm />
						</Suspense>
					</div>
				</div>
			</section>
		</main>
	);
}
