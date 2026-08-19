import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { AuthForm } from "./auth-form";
import style from "./auth-form.module.css";

export const metadata: Metadata = {
	title: "Account access",
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
					<p className={style.eyebrow}>Community accounts</p>
					<h1 id="auth-page-title">Share what&apos;s happening in Sacramento.</h1>
					<p className={style.introCopy}>
						Create an account to submit local tech events, or sign in to manage
						the events you have already shared.
					</p>

					<ol className={style.process}>
						<li>
							<span aria-hidden="true">01</span>
							Submit an event for the community calendar.
						</li>
						<li>
							<span aria-hidden="true">02</span>
							A SacTech admin reviews the details.
						</li>
						<li>
							<span aria-hidden="true">03</span>
							Approved events appear publicly.
						</li>
					</ol>
				</div>

				<div className={style.formPanel}>
					<AuthForm />
				</div>
			</section>
		</main>
	);
}
