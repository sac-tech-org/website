import Link from "next/link";
import { redirect } from "next/navigation";
import style from "../auth-form.module.css";

const ACCOUNT_ROUTE = "/account";

interface VerifyEmailResultProps {
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

export async function VerifyEmailResult({
	searchParams,
}: VerifyEmailResultProps) {
	const error = getFirstSearchParam((await searchParams).error);

	if (!error) {
		redirect(ACCOUNT_ROUTE);
	}

	const issue = getVerificationIssue(error);

	return (
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
	);
}
