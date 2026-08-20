import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";
import style from "../auth-form.module.css";

export const metadata: Metadata = {
	title: "Reset your password",
	description: "Choose a new password for your SacTech account.",
};

interface ResetPasswordPageProps {
	searchParams: Promise<{
		error?: string | string[];
		token?: string | string[];
	}>;
}

function getSingleSearchParam(value: string | string[] | undefined) {
	return typeof value === "string" && value ? value : null;
}

export default async function ResetPasswordPage({
	searchParams,
}: ResetPasswordPageProps) {
	const params = await searchParams;
	const error = getSingleSearchParam(params.error);
	const token = getSingleSearchParam(params.token);

	return (
		<main className={style.page} id="main-content">
			<section
				aria-labelledby="reset-password-page-title"
				className={style.shell}
			>
				<div className={style.intro}>
					<p className={style.eyebrow}>Your SacTech account</p>
					<h1 id="reset-password-page-title">Choose a new password.</h1>
					<p className={style.introCopy}>
						Use the link from your reset email to set a new password for your
						account.
					</p>

					<ol className={style.process}>
						<li>
							<span aria-hidden="true">01</span>
							Open the secure link from your email.
						</li>
						<li>
							<span aria-hidden="true">02</span>
							Choose a new password for your account.
						</li>
						<li>
							<span aria-hidden="true">03</span>
							Return to SacTech and sign in.
						</li>
					</ol>
				</div>

				<div className={style.formPanel}>
					<ResetPasswordForm error={error} token={token} />
				</div>
			</section>
		</main>
	);
}
