"use client";

/* eslint-disable @next/next/no-img-element -- Event images use Blob-backed URLs that are not known at build time. */
import { useState } from "react";
import style from "./event-card-image.module.css";

interface EventCardImageProps {
	imageUrl?: string;
}

export function EventCardImage({ imageUrl }: EventCardImageProps) {
	const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

	if (!imageUrl || imageUrl === failedImageUrl) {
		return null;
	}

	return (
		<img
			alt=""
			className={style.image}
			decoding="async"
			height={675}
			loading="lazy"
			onError={() => setFailedImageUrl(imageUrl)}
			src={imageUrl}
			width={1200}
		/>
	);
}
