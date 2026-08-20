"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import style from "../auth-form.module.css";

const MINIMUM_PASSWORD_LENGTH = 10;
const MAXIMUM_PASSWORD_LENGTH = 128;

type PasswordField = "confirmPassword" | "newPassword";

interface ResetPasswordFormProps {
	error: string | null;
	token: string | null;
}

interface AuthError {
	code?: string;
	message?: string;
}

interface PasswordIssue {
	describedFields: PasswordField[];
	focusField: PasswordField;
	invalidFields: PasswordField[];
	message: string;
}

function isTokenError(error: AuthError) {
	return (
		error.code === "INVALID_TOKEN" ||
		error.code === "TOKEN_EXPIRED" ||
		error.code === "EXPIRED_TOKEN"
	);
}

function getServiceIssue(error: AuthError): PasswordIssue {
	switch (error.code) {
		case "PASSWORD_TOO_SHORT":
			return {
				describedFields: ["newPassword"],
				focusField: "newPassword",
				invalidFields: ["newPassword"],
				message: `Your password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
			};
		case "PASSWORD_TOO_LONG":
			return {
				describedFields: ["newPassword"],
				focusField: "newPassword",
				invalidFields: ["newPassword"],
				message: `Your password must be no more than ${MAXIMUM_PASSWORD_LENGTH} characters.`,
			};
		default:
			return {
				describedFields: ["newPassword"],
				focusField: "newPassword",
				invalidFields: [],
				message: error.message ?? "We couldn't reset your password. Try again.",
			};
	}
}

function UnavailableResetLink({
	focusOnRender = false,
	missing,
}: {
	focusOnRender?: boolean;
	missing: boolean;
}) {
	const headingRef = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		if (focusOnRender) {
			headingRef.current?.focus();
		}
	}, [focusOnRender]);

	return (
		<div className={style.formCard}>
			<div className={style.formHeading}>
				<h2 ref={headingRef} tabIndex={-1}>
					Request a new reset link
				</h2>
				<p>
					{missing
						? "This password reset link is missing its token. Open the link from your email or request a new one."
						: "This password reset link is invalid or has expired. Request a new one to keep going."}
				</p>
			</div>
			<div className={style.form}>
				<Link className={style.submitButton} href="/auth">
					Back to sign in <span aria-hidden="true">→</span>
				</Link>
			</div>
		</div>
	);
}

export function ResetPasswordForm({
	error: initialError,
	token,
}: ResetPasswordFormProps) {
	const [issue, setIssue] = useState<PasswordIssue | null>(null);
	const [isPending, setIsPending] = useState(false);
	const [isSuccessful, setIsSuccessful] = useState(false);
	const [tokenWasRejected, setTokenWasRejected] = useState(false);
	const newPasswordRef = useRef<HTMLInputElement>(null);
	const confirmPasswordRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!issue || isPending) {
			return;
		}

		const focusTargets: Record<PasswordField, HTMLInputElement | null> = {
			confirmPassword: confirmPasswordRef.current,
			newPassword: newPasswordRef.current,
		};
		focusTargets[issue.focusField]?.focus();
	}, [isPending, issue]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIssue(null);

		if (!token) {
			setTokenWasRejected(true);
			return;
		}

		const formData = new FormData(event.currentTarget);
		const newPassword = String(formData.get("newPassword") ?? "");
		const confirmPassword = String(formData.get("confirmPassword") ?? "");

		if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
			setIssue({
				describedFields: ["newPassword"],
				focusField: "newPassword",
				invalidFields: ["newPassword"],
				message: `Your password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
			});
			return;
		}

		if (newPassword.length > MAXIMUM_PASSWORD_LENGTH) {
			setIssue({
				describedFields: ["newPassword"],
				focusField: "newPassword",
				invalidFields: ["newPassword"],
				message: `Your password must be no more than ${MAXIMUM_PASSWORD_LENGTH} characters.`,
			});
			return;
		}

		if (newPassword !== confirmPassword) {
			setIssue({
				describedFields: ["confirmPassword"],
				focusField: "confirmPassword",
				invalidFields: ["confirmPassword"],
				message: "The passwords don't match.",
			});
			return;
		}

		setIsPending(true);

		try {
			const result = await authClient.resetPassword({ newPassword, token });

			if (result.error) {
				if (isTokenError(result.error)) {
					setTokenWasRejected(true);
					return;
				}

				setIssue(getServiceIssue(result.error));
				return;
			}

			setIsSuccessful(true);
		} catch {
			setIssue({
				describedFields: ["newPassword"],
				focusField: "newPassword",
				invalidFields: [],
				message:
					"We couldn't connect to the account service. Check your connection and try again.",
			});
		} finally {
			setIsPending(false);
		}
	}

	if (!token || initialError || tokenWasRejected) {
		return (
			<UnavailableResetLink
				focusOnRender={tokenWasRejected}
				missing={!token && !initialError}
			/>
		);
	}

	if (isSuccessful) {
		return (
			<div className={style.formCard}>
				<div aria-atomic="true" className={style.formHeading} role="status">
					<h2>Your password has been reset</h2>
					<p>You can now sign in to SacTech with your new password.</p>
				</div>
				<div className={style.form}>
					<Link className={style.submitButton} href="/auth">
						Back to sign in <span aria-hidden="true">→</span>
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className={style.formCard}>
			<div className={style.formHeading}>
				<h2>Reset your password</h2>
				<p>Enter and confirm the new password you want to use.</p>
			</div>

			<form
				aria-busy={isPending}
				className={style.form}
				noValidate
				onChange={() => setIssue(null)}
				onSubmit={handleSubmit}
			>
				<div className={style.field}>
					<label htmlFor="reset-password-new">New password</label>
					<input
						aria-describedby={
							issue?.describedFields.includes("newPassword")
								? "reset-password-hint reset-password-error"
								: "reset-password-hint"
						}
						aria-invalid={
							issue?.invalidFields.includes("newPassword") || undefined
						}
						autoComplete="new-password"
						disabled={isPending}
						id="reset-password-new"
						maxLength={MAXIMUM_PASSWORD_LENGTH}
						minLength={MINIMUM_PASSWORD_LENGTH}
						name="newPassword"
						ref={newPasswordRef}
						required
						type="password"
					/>
					<p className={style.hint} id="reset-password-hint">
						{MINIMUM_PASSWORD_LENGTH}–{MAXIMUM_PASSWORD_LENGTH} characters.
					</p>
				</div>

				<div className={style.field}>
					<label htmlFor="reset-password-confirm">Confirm new password</label>
					<input
						aria-describedby={
							issue?.describedFields.includes("confirmPassword")
								? "reset-password-error"
								: undefined
						}
						aria-invalid={
							issue?.invalidFields.includes("confirmPassword") || undefined
						}
						autoComplete="new-password"
						disabled={isPending}
						id="reset-password-confirm"
						maxLength={MAXIMUM_PASSWORD_LENGTH}
						minLength={MINIMUM_PASSWORD_LENGTH}
						name="confirmPassword"
						ref={confirmPasswordRef}
						required
						type="password"
					/>
				</div>

				<button
					className={style.submitButton}
					disabled={isPending}
					type="submit"
				>
					{isPending ? "Resetting password…" : "Reset password"}
					<span aria-hidden="true">→</span>
				</button>

				<div className={style.status}>
					{issue && (
						<p aria-atomic="true" id="reset-password-error" role="alert">
							{issue.message}
						</p>
					)}
				</div>
			</form>
		</div>
	);
}
