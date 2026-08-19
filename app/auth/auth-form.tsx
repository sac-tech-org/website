"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import style from "./auth-form.module.css";

const ACCOUNT_ROUTE = "/account";
const MINIMUM_PASSWORD_LENGTH = 10;

type AuthMode = "sign-in" | "sign-up";

interface AuthError {
	code?: string;
	message?: string;
}

function getAuthErrorMessage(error: AuthError, mode: AuthMode) {
	switch (error.code) {
		case "INVALID_EMAIL_OR_PASSWORD":
			return "That email and password combination did not match.";
		case "PASSWORD_TOO_SHORT":
			return `Your password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return "An account already exists for that email. Try signing in instead.";
		default:
			return (
				error.message ??
				(mode === "sign-in"
					? "We could not sign you in. Please try again."
					: "We could not create your account. Please try again.")
			);
	}
}

export function AuthForm() {
	const router = useRouter();
	const [mode, setMode] = useState<AuthMode>("sign-in");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	function selectMode(nextMode: AuthMode) {
		setMode(nextMode);
		setErrorMessage(null);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage(null);

		const formData = new FormData(event.currentTarget);
		const email = String(formData.get("email") ?? "").trim();
		const name = String(formData.get("name") ?? "").trim();
		const password = String(formData.get("password") ?? "");

		if (mode === "sign-up" && !name) {
			setErrorMessage("Enter your name to create an account.");
			return;
		}

		if (password.length < MINIMUM_PASSWORD_LENGTH) {
			setErrorMessage(
				`Your password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
			);
			return;
		}

		setIsPending(true);

		try {
			const result =
				mode === "sign-up"
					? await authClient.signUp.email({
							email,
							name,
							password,
						})
					: await authClient.signIn.email({ email, password });

			if (result.error) {
				setErrorMessage(getAuthErrorMessage(result.error, mode));
				return;
			}

			// This fixed relative path keeps post-auth navigation on this origin.
			router.replace(ACCOUNT_ROUTE);
			router.refresh();
		} catch {
			setErrorMessage(
				"We could not reach the account service. Check your connection and try again.",
			);
		} finally {
			setIsPending(false);
		}
	}

	const isCreatingAccount = mode === "sign-up";

	return (
		<div className={style.formCard}>
			<div
				aria-label="Choose an account action"
				className={style.modeSwitcher}
				role="group"
			>
				<button
					aria-pressed={mode === "sign-in"}
					className={style.modeButton}
					disabled={isPending}
					onClick={() => selectMode("sign-in")}
					type="button"
				>
					Sign in
				</button>
				<button
					aria-pressed={isCreatingAccount}
					className={style.modeButton}
					disabled={isPending}
					onClick={() => selectMode("sign-up")}
					type="button"
				>
					Create account
				</button>
			</div>

			<div className={style.formHeading}>
				<h2>{isCreatingAccount ? "Create your account" : "Welcome back"}</h2>
				<p>
					{isCreatingAccount
						? "Use your account to submit events for SacTech review."
						: "Sign in to submit an event or check on an existing submission."}
				</p>
			</div>

			<form aria-busy={isPending} className={style.form} onSubmit={handleSubmit}>
				{isCreatingAccount && (
					<div className={style.field}>
						<label htmlFor="auth-name">Name</label>
						<input
							autoComplete="name"
							disabled={isPending}
							id="auth-name"
							name="name"
							required
							type="text"
						/>
					</div>
				)}

				<div className={style.field}>
					<label htmlFor="auth-email">Email address</label>
					<input
						autoCapitalize="none"
						autoComplete="email"
						disabled={isPending}
						id="auth-email"
						inputMode="email"
						name="email"
						required
						spellCheck={false}
						type="email"
					/>
				</div>

				<div className={style.field}>
					<label htmlFor="auth-password">Password</label>
					<input
						aria-describedby="auth-password-hint"
						autoComplete={
							isCreatingAccount ? "new-password" : "current-password"
						}
						disabled={isPending}
						id="auth-password"
						maxLength={128}
						minLength={MINIMUM_PASSWORD_LENGTH}
						name="password"
						required
						type="password"
					/>
					<p className={style.hint} id="auth-password-hint">
						At least {MINIMUM_PASSWORD_LENGTH} characters.
					</p>
				</div>

				<button className={style.submitButton} disabled={isPending} type="submit">
					{isPending
						? isCreatingAccount
							? "Creating account…"
							: "Signing in…"
						: isCreatingAccount
							? "Create account"
							: "Sign in"}
					<span aria-hidden="true">→</span>
				</button>

				<div
					aria-atomic="true"
					aria-live="polite"
					className={style.status}
					role="status"
				>
					{errorMessage && <p>{errorMessage}</p>}
				</div>
			</form>
		</div>
	);
}
