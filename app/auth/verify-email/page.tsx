import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import style from "../auth-form.module.css";

const ACCOUNT_ROUTE = "/account";

export const metadata: Metadata = {
	title: "Verify your email",
	description: "Finish verifying your SacTech account email address.",
};

interface VerifyEmailPageProps {
	searchParams: Promise<{
		error?: string | string[];
	}>;
}

interface VerificationIssue {
	heading: string;
	message: string;
}

function getFirstSearchParam(value: string | string[] | undefined) {
	if (Array.isArray(value)) {
		return value.find(Boolean) ?? null;
	}

	return value || null;
}

function getVerificationIssue(error: string): VerificationIssue {
	switch (error) {
		case "TOKEN_EXPIRED":
		case "EXPIRED_TOKEN":
			return {
				heading: "Verification link expired",
				message:
					"This verification link has expired. Sign in again with your email and password to request a new link.",
			};
		case "INVALID_TOKEN":
			return {
				heading: "Verification link unavailable",
				message:
					"This verification link is invalid or has already been used. Sign in again to request a new link if your email still needs verification.",
			};
		default:
			return {
				heading: "We couldn't verify your email",
				message:
					"This verification link can't be used. Sign in again to request a new link if your email still needs verification.",
			};
	}
}

export default async function VerifyEmailPage({
	searchParams,
}: VerifyEmailPageProps) {
	const error = getFirstSearchParam((await searchParams).error);

	if (!error) {
		redirect(ACCOUNT_ROUTE);
	}

	const issue = getVerificationIssue(error);

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
					<div className={style.formCard}>
						<div className={style.formHeading} role="alert">
							<h2>{issue.heading}</h2>
							<p>{issue.message}</p>
						</div>
						<div className={style.form}>
							<Link className={style.submitButton} href="/auth">
								Back to sign in <span aria-hidden="true">→</span>
							</Link>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
