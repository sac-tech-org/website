import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { EventForm } from "./event-form";
import style from "./event-form.module.css";

export const metadata: Metadata = {
	title: "Submit an event",
	description:
		"Share a Sacramento technology event with the SacTech community calendar.",
};

export default async function SubmitEventPage() {
	await requireSession();

	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="page-title" className={style.hero}>
				<div className={style.heroInner}>
					<p className={style.eyebrow}>Community calendar</p>
					<h1 id="page-title">Share an event with Sacramento.</h1>
					<p>
						Tell us what is happening, when people should arrive, and how
						they can take part. A SacTech admin will review your submission
						before it appears on the public calendar.
					</p>
				</div>
			</section>

			<section aria-labelledby="form-title" className={style.content}>
				<div className={style.layout}>
					<aside className={style.guide}>
						<p className={style.guideEyebrow}>Before you submit</p>
						<h2 id="form-title">Give reviewers the useful details.</h2>
						<ul>
							<li>Use the event&apos;s public-facing title and description.</li>
							<li>
								Enter the start and end in Pacific time. Daylight saving time
								is handled automatically.
							</li>
							<li>
								Include a venue for in-person gatherings and a link for online
								ones.
							</li>
						</ul>
						<p className={style.reviewNote}>
							<strong>Every event starts as pending.</strong> It will only be
							published after a SacTech admin approves it.
						</p>
					</aside>

					<div className={style.formCard}>
						<EventForm />
					</div>
				</div>
			</section>
		</main>
	);
}
