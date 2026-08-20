import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isEmailDeliveryEnabled } from "@/lib/email-delivery";
import { getCurrentSession } from "@/lib/session";
import { AuthForm } from "./auth-form";
import style from "./auth-form.module.css";

export const metadata: Metadata = {
	title: "Sign in or create an account",
	description:
		"Sign in to SacTech or create an account to submit community events.",
};

export default async function AuthPage() {
	const session = await getCurrentSession();

	if (session) {
		redirect("/account");
	}

	return (
		<main className={style.page} id="main-content">
			<section aria-labelledby="auth-page-title" className={style.shell}>
				<div className={style.intro}>
					<p className={style.eyebrow}>Your SacTech account</p>
					<h1 id="auth-page-title">Share a local tech event.</h1>
					<p className={style.introCopy}>
						Create an account to submit an event. Already have one? Sign in to
						manage your submissions.
					</p>

					<ol className={style.process}>
						<li>
							<span aria-hidden="true">01</span>
							Send us an event for the community calendar.
						</li>
						<li>
							<span aria-hidden="true">02</span>A SacTech reviewer checks the
							details.
						</li>
						<li>
							<span aria-hidden="true">03</span>
							Once approved, the event appears on the public calendar.
						</li>
					</ol>
				</div>

				<div className={style.formPanel}>
					<AuthForm emailDeliveryEnabled={isEmailDeliveryEnabled()} />
				</div>
			</section>
		</main>
	);
}
