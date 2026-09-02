"use client";

/* eslint-disable @next/next/no-img-element -- Event headers intentionally use native images for Blob-backed URLs. */
import Link from "next/link";
import { useState } from "react";
import { EventChip } from "../components/event-chip/event-chip";
import type { Event } from "../types";
import style from "./event-detail.module.css";

interface EventHeaderProps {
	imageUrl?: string;
	inPerson: boolean;
	isOnline: boolean;
	isRecurring: boolean;
	recurrenceRule: Event["recurrence_rule"];
	title: string;
}

export function EventHeader({
	imageUrl,
	inPerson,
	isOnline,
	isRecurring,
	recurrenceRule,
	title,
}: EventHeaderProps) {
	const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
	const showImage = Boolean(imageUrl && imageUrl !== failedImageUrl);

	return (
		<section aria-labelledby="event-title" className={style.hero}>
			<div className={style.heroInner}>
				<Link className={style.backLink} href="/events">
					<span aria-hidden="true">←</span> Back to all events
				</Link>

				<div
					className={
						showImage
							? `${style.heroLayout} ${style.heroLayoutWithImage}`
							: style.heroLayout
					}
				>
					<div className={style.heroCopy}>
						<p className={style.eyebrow}>
							{isRecurring ? "Recurring event" : "Special event"}
						</p>
						<h1 id="event-title">{title}</h1>
						<ul aria-label="Event type" className={style.chips} role="list">
							{inPerson && (
								<li>
									<EventChip size="default" variant="in-person" />
								</li>
							)}
							{isOnline && (
								<li>
									<EventChip size="default" variant="online" />
								</li>
							)}
							{recurrenceRule?.interval === 1 && (
								<li>
									<EventChip
										every={recurrenceRule.frequency}
										size="default"
										variant="recurring"
									/>
								</li>
							)}
						</ul>
					</div>

					{imageUrl && imageUrl !== failedImageUrl && (
						<img
							alt=""
							className={style.heroImage}
							onError={() => setFailedImageUrl(imageUrl)}
							src={imageUrl}
						/>
					)}
				</div>
			</div>
		</section>
	);
}
