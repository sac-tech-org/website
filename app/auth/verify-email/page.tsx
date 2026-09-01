import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailResult } from "./verification-result";
import style from "../auth-form.module.css";

export const metadata: Metadata = {
	title: "Verify your email",
	description: "Finish verifying your SacTech account email address.",
};

interface VerifyEmailPageProps {
	searchParams: Promise<{
		error?: string | string[];
	}>;
}

function VerifyEmailFallback() {
	return (
		<div className={style.formCard} role="status">
			<div className={style.formHeading}>
				<h2>Checking your verification link</h2>
				<p>We’re confirming the next step for your account.</p>
			</div>
		</div>
	);
}

export default function VerifyEmailPage({
	searchParams,
}: VerifyEmailPageProps) {
	return (
		<main className={style.page} id="main-content">
			<section
				aria-labelledby="verify-email-page-title"
				className={style.shell}
			>
				<div className={style.intro}>
					<p className={style.eyebrow}>Your SacTech account</p>
					<h1 id="verify-email-page-title">Verify your email.</h1>
					<p className={style.introCopy}>
						Email verification helps us keep event submissions tied to the right
						account.
					</p>

					<ol className={style.process}>
						<li>
							<span aria-hidden="true">01</span>
							Return to the SacTech sign-in page.
						</li>
						<li>
							<span aria-hidden="true">02</span>
							Sign in with the email and password you chose.
						</li>
						<li>
							<span aria-hidden="true">03</span>
							Open the fresh verification link from your inbox.
						</li>
					</ol>
				</div>

				<div className={style.formPanel}>
					<Suspense fallback={<VerifyEmailFallback />}>
						<VerifyEmailResult searchParams={searchParams} />
					</Suspense>
				</div>
			</section>
		</main>
	);
}
