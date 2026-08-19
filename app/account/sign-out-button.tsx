"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import style from "@/app/auth/auth-form.module.css";

const AUTH_ROUTE = "/auth";

interface SignOutButtonProps {
	className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	async function handleSignOut() {
		setIsPending(true);
		setErrorMessage(null);

		try {
			const result = await authClient.signOut();

			if (result.error) {
				setErrorMessage(
					result.error.message ?? "We could not sign you out. Please try again.",
				);
				return;
			}

			// This fixed relative path keeps post-auth navigation on this origin.
			router.replace(AUTH_ROUTE);
			router.refresh();
		} catch {
			setErrorMessage(
				"We could not reach the account service. Check your connection and try again.",
			);
		} finally {
			setIsPending(false);
		}
	}

	return (
		<div className={style.signOutControl}>
			<button
				className={[style.signOutButton, className].filter(Boolean).join(" ")}
				disabled={isPending}
				onClick={handleSignOut}
				type="button"
			>
				{isPending ? "Signing out…" : "Sign out"}
			</button>
			<div
				aria-atomic="true"
				aria-live="polite"
				className={style.signOutStatus}
				role="status"
			>
				{errorMessage && <p className={style.signOutError}>{errorMessage}</p>}
			</div>
		</div>
	);
}
