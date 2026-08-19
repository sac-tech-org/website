"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import style from "./join-community.module.css";

interface JoinCommunityProps {
	inviteLink?: string;
}

export function JoinCommunity({ inviteLink }: JoinCommunityProps) {
	const [agreed, setAgreed] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!agreed) {
			setMessage("Please agree to the Code of Conduct before joining.");
			return;
		}

		if (!inviteLink) {
			setMessage("The Slack invite isn't ready yet. Please check back soon.");
			return;
		}

		window.location.assign(inviteLink);
	}

	if (!inviteLink) {
		return (
			<div className={style.unavailable}>
				<strong>We&apos;re updating the Slack invitations.</strong>
				<p>
					We&apos;ll post the new community invite here when it&apos;s ready.
					Until then, you can read our{" "}
					<Link href="/code-of-conduct">Code of Conduct</Link>.
				</p>
			</div>
		);
	}

	return (
		<form className={style.form} onSubmit={handleSubmit}>
			<label className={style.agreement}>
				<input
					checked={agreed}
					onChange={(event) => {
						setAgreed(event.target.checked);
						setMessage(null);
					}}
					type="checkbox"
				/>
				<span>
					I agree to the <Link href="/code-of-conduct">Code of Conduct</Link>.
				</span>
			</label>
			<button className={style.button} type="submit">
				Join SacTech Slack <span aria-hidden="true">→</span>
			</button>
			{message && (
				<p className={style.message} role="status">
					{message}
				</p>
			)}
		</form>
	);
}
