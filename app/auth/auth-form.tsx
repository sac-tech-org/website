"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import style from "./auth-form.module.css";

const ACCOUNT_ROUTE = "/account";
const RESET_PASSWORD_ROUTE = "/auth/reset-password";
const VERIFICATION_CALLBACK_ROUTE = "/auth/verify-email";
const MINIMUM_PASSWORD_LENGTH = 10;

type AuthMode = "forgot-password" | "sign-in" | "sign-up";
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

interface AuthSuccess {
	heading: string;
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
		case "EMAIL_NOT_VERIFIED":
			return {
				describedFields: ["email", "password"],
				focusField: "email",
				invalidFields: [],
				message:
					"Verify your email before signing in. Check your inbox for a new link; if it doesn't arrive, try again later.",
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
	const [success, setSuccess] = useState<AuthSuccess | null>(null);
	const [isPending, setIsPending] = useState(false);
	const emailRef = useRef<HTMLInputElement>(null);
	const formHeadingRef = useRef<HTMLHeadingElement>(null);
	const nameRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const shouldFocusHeadingRef = useRef(false);
	const successHeadingRef = useRef<HTMLHeadingElement>(null);

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

	useEffect(() => {
		if (!shouldFocusHeadingRef.current) {
			return;
		}

		const heading = success
			? successHeadingRef.current
			: formHeadingRef.current;
		heading?.focus();
		shouldFocusHeadingRef.current = false;
	}, [mode, success]);

	function selectMode(nextMode: AuthMode, focusHeading = false) {
		shouldFocusHeadingRef.current = focusHeading;
		setMode(nextMode);
		setIssue(null);
		setSuccess(null);
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

		if (
			mode !== "forgot-password" &&
			password.length < MINIMUM_PASSWORD_LENGTH
		) {
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
			if (mode === "forgot-password") {
				const result = await authClient.requestPasswordReset({
					email,
					redirectTo: RESET_PASSWORD_ROUTE,
				});

				if (result.error) {
					setIssue({
						describedFields: ["email"],
						focusField: "email",
						invalidFields: [],
						message:
							"We couldn't start a password reset. Try again in a moment.",
					});
					return;
				}

				shouldFocusHeadingRef.current = true;
				setSuccess({
					heading: "Check your email",
					message:
						"If an account exists for that address, we'll send a password reset link shortly.",
				});
				return;
			}

			const result =
				mode === "sign-up"
					? await authClient.signUp.email({
							callbackURL: VERIFICATION_CALLBACK_ROUTE,
							email,
							name,
							password,
						})
					: await authClient.signIn.email({
							callbackURL: VERIFICATION_CALLBACK_ROUTE,
							email,
							password,
						});

			if (result.error) {
				setIssue(getAuthIssue(result.error, mode));
				return;
			}

			if (mode === "sign-up") {
				shouldFocusHeadingRef.current = true;
				setSuccess({
					heading: "Check your email",
					message:
						"If this address can be used to create an account, we'll send a verification link shortly. The link expires in one hour.",
				});
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
	const isResetRequest = mode === "forgot-password";

	if (success) {
		return (
			<div className={style.formCard}>
				<div aria-live="polite" className={style.successMessage} role="status">
					<p className={style.successEyebrow}>Next step</p>
					<h2 ref={successHeadingRef} tabIndex={-1}>
						{success.heading}
					</h2>
					<p>{success.message}</p>
				</div>
				<button
					className={style.textButton}
					onClick={() => selectMode("sign-in", true)}
					type="button"
				>
					Back to sign in
				</button>
			</div>
		);
	}

	return (
		<div className={style.formCard}>
			{!isResetRequest && (
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
			)}

			<div className={style.formHeading}>
				<h2 ref={formHeadingRef} tabIndex={-1}>
					{isResetRequest
						? "Reset your password"
						: isCreatingAccount
							? "Create an account"
							: "Welcome back"}
				</h2>
				<p>
					{isResetRequest
						? "Enter your email and we'll send you a secure reset link."
						: isCreatingAccount
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

				{!isResetRequest && (
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
						{mode === "sign-in" && (
							<button
								className={style.textButton}
								disabled={isPending}
								onClick={() => selectMode("forgot-password", true)}
								type="button"
							>
								Forgot your password?
							</button>
						)}
					</div>
				)}

				<button
					className={style.submitButton}
					disabled={isPending}
					type="submit"
				>
					{isPending
						? isResetRequest
							? "Sending reset link…"
							: isCreatingAccount
								? "Creating account…"
								: "Signing in…"
						: isResetRequest
							? "Send reset link"
							: isCreatingAccount
								? "Create account"
								: "Sign in"}
					<span aria-hidden="true">→</span>
				</button>

				{isResetRequest && (
					<button
						className={style.textButton}
						disabled={isPending}
						onClick={() => selectMode("sign-in", true)}
						type="button"
					>
						Back to sign in
					</button>
				)}

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
