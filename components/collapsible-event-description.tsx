"use client";

import { useId, useState } from "react";
import { EventDescriptionMarkdown } from "./event-description-markdown";
import style from "./collapsible-event-description.module.css";

const COLLAPSED_DESCRIPTION_CHARACTERS = 300;

interface CollapsibleEventDescriptionProps {
	className?: string;
	eventTitle: string;
	markdown: string;
}

export function CollapsibleEventDescription({
	className,
	eventTitle,
	markdown,
}: CollapsibleEventDescriptionProps) {
	const [expanded, setExpanded] = useState(false);
	const descriptionId = useId();
	const isCollapsible = markdown.length > COLLAPSED_DESCRIPTION_CHARACTERS;
	const action = expanded ? "Show less" : "Show more";

	return (
		<div className={style.container}>
			<div id={descriptionId}>
				<EventDescriptionMarkdown
					className={className}
					markdown={markdown}
					maxCharacters={
						isCollapsible && !expanded
							? COLLAPSED_DESCRIPTION_CHARACTERS
							: undefined
					}
				/>
			</div>
			{isCollapsible && (
				<button
					aria-controls={descriptionId}
					aria-expanded={expanded}
					aria-label={`${action} details for ${eventTitle}`}
					className={style.toggle}
					onClick={() => setExpanded((current) => !current)}
					type="button"
				>
					{action} details
					<span aria-hidden="true">{expanded ? "−" : "+"}</span>
				</button>
			)}
		</div>
	);
}
