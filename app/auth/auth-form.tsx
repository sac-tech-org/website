"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import style from "./auth-form.module.css";

const ACCOUNT_ROUTE = "/account";
const MINIMUM_PASSWORD_LENGTH = 10;

type AuthMode = "sign-in" | "sign-up";
type AuthField = "email" | "name" | "password";

interface AuthError {
	code?: string;
	message?: string;
}

interface AuthIssue {
	describedFields: AuthField[];
	focusField: AuthField;
	invalidFields: AuthField[];
	message: string;
}

function getAuthIssue(error: AuthError, mode: AuthMode): AuthIssue {
	switch (error.code) {
		case "INVALID_EMAIL_OR_PASSWORD":
			return {
				describedFields: ["email", "password"],
				focusField: "email",
				invalidFields: ["email", "password"],
				message: "That email and password don't match.",
			};
		case "PASSWORD_TOO_SHORT":
			return {
				describedFields: ["password"],
				focusField: "password",
				invalidFields: ["password"],
				message: `Your password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
			};
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return {
				describedFields: ["email"],
				focusField: "email",
				invalidFields: ["email"],
				message:
					"An account already exists for that email. Try signing in instead.",
			};
		default:
			return {
				describedFields: ["email"],
				focusField: "email",
				invalidFields: [],
				message:
					error.message ??
					(mode === "sign-in"
						? "We couldn't sign you in. Try again."
						: "We couldn't create your account. Try again."),
			};
	}
}

export function AuthForm() {
	const router = useRouter();
	const [mode, setMode] = useState<AuthMode>("sign-in");
	const [issue, setIssue] = useState<AuthIssue | null>(null);
	const [isPending, setIsPending] = useState(false);
	const emailRef = useRef<HTMLInputElement>(null);
	const nameRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!issue || isPending) {
			return;
		}

		const focusTargets: Record<AuthField, HTMLInputElement | null> = {
			email: emailRef.current,
			name: nameRef.current,
			password: passwordRef.current,
		};
		focusTargets[issue.focusField]?.focus();
	}, [isPending, issue]);

	function selectMode(nextMode: AuthMode) {
		setMode(nextMode);
		setIssue(null);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIssue(null);

		const formData = new FormData(event.currentTarget);
		const email = String(formData.get("email") ?? "").trim();
		const name = String(formData.get("name") ?? "").trim();
		const password = String(formData.get("password") ?? "");

		if (mode === "sign-up" && !name) {
			setIssue({
				describedFields: ["name"],
				focusField: "name",
				invalidFields: ["name"],
				message: "Enter your name to create an account.",
			});
			return;
		}

		if (password.length < MINIMUM_PASSWORD_LENGTH) {
			setIssue({
				describedFields: ["password"],
				focusField: "password",
				invalidFields: ["password"],
				message: `Your password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
			});
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
				setIssue(getAuthIssue(result.error, mode));
				return;
			}

			// This fixed relative path keeps post-auth navigation on this origin.
			router.replace(ACCOUNT_ROUTE);
			router.refresh();
		} catch {
			setIssue({
				describedFields: ["email"],
				focusField: "email",
				invalidFields: [],
				message:
					"We couldn't connect to the account service. Check your connection and try again.",
			});
		} finally {
			setIsPending(false);
		}
	}

	const isCreatingAccount = mode === "sign-up";

	return (
		<div className={style.formCard}>
			<div
				aria-label="Sign in or create an account"
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
				<h2>{isCreatingAccount ? "Create an account" : "Welcome back"}</h2>
				<p>
					{isCreatingAccount
						? "Create an account to send events to SacTech for review."
						: "Sign in to submit an event or check one you've already sent."}
				</p>
			</div>

			<form
				aria-busy={isPending}
				className={style.form}
				onChange={() => setIssue(null)}
				onSubmit={handleSubmit}
			>
				{isCreatingAccount && (
					<div className={style.field}>
						<label htmlFor="auth-name">Name</label>
						<input
							aria-describedby={
								issue?.describedFields.includes("name")
									? "auth-error"
									: undefined
							}
							aria-invalid={issue?.invalidFields.includes("name") || undefined}
							autoComplete="name"
							disabled={isPending}
							id="auth-name"
							name="name"
							ref={nameRef}
							required
							type="text"
						/>
					</div>
				)}

				<div className={style.field}>
					<label htmlFor="auth-email">Email address</label>
					<input
						aria-describedby={
							issue?.describedFields.includes("email")
								? "auth-error"
								: undefined
						}
						aria-invalid={issue?.invalidFields.includes("email") || undefined}
						autoCapitalize="none"
						autoComplete="email"
						disabled={isPending}
						id="auth-email"
						inputMode="email"
						name="email"
						ref={emailRef}
						required
						spellCheck={false}
						type="email"
					/>
				</div>

				<div className={style.field}>
					<label htmlFor="auth-password">Password</label>
					<input
						aria-describedby={
							issue?.describedFields.includes("password")
								? "auth-password-hint auth-error"
								: "auth-password-hint"
						}
						aria-invalid={
							issue?.invalidFields.includes("password") || undefined
						}
						autoComplete={
							isCreatingAccount ? "new-password" : "current-password"
						}
						disabled={isPending}
						id="auth-password"
						maxLength={128}
						minLength={MINIMUM_PASSWORD_LENGTH}
						name="password"
						ref={passwordRef}
						required
						type="password"
					/>
					<p className={style.hint} id="auth-password-hint">
						At least {MINIMUM_PASSWORD_LENGTH} characters.
					</p>
				</div>

				<button
					className={style.submitButton}
					disabled={isPending}
					type="submit"
				>
					{isPending
						? isCreatingAccount
							? "Creating account…"
							: "Signing in…"
						: isCreatingAccount
							? "Create account"
							: "Sign in"}
					<span aria-hidden="true">→</span>
				</button>

				<div className={style.status}>
					{issue && (
						<p aria-atomic="true" id="auth-error" role="alert">
							{issue.message}
						</p>
					)}
				</div>
			</form>
		</div>
	);
}
