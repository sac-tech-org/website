"use client";

import { ChevronDown, Download, ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
	createGoogleCalendarUrl,
	createIcsContent,
	createIcsFilename,
	type CalendarEventData,
} from "@/lib/events/calendar-export";
import style from "./calendar-actions.module.css";

interface CalendarActionsProps {
	calendarEvent: CalendarEventData;
	fullWidth?: boolean;
}

export function CalendarActions({
	calendarEvent,
	fullWidth = false,
}: CalendarActionsProps) {
	const [isOpen, setIsOpen] = useState(false);
	const panelId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		function closeOnOutsidePointer(event: PointerEvent) {
			if (
				event.target instanceof Node &&
				!rootRef.current?.contains(event.target)
			) {
				setIsOpen(false);
			}
		}

		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setIsOpen(false);
				triggerRef.current?.focus();
			}
		}

		document.addEventListener("pointerdown", closeOnOutsidePointer);
		document.addEventListener("keydown", closeOnEscape);

		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointer);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [isOpen]);

	function closeAndRestoreFocus() {
		setIsOpen(false);
		triggerRef.current?.focus();
	}

	function downloadIcs() {
		const blob = new Blob([createIcsContent(calendarEvent)], {
			type: "text/calendar;charset=utf-8",
		});
		const objectUrl = URL.createObjectURL(blob);
		const link = document.createElement("a");

		link.download = createIcsFilename(calendarEvent);
		link.href = objectUrl;
		link.hidden = true;
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
		closeAndRestoreFocus();
	}

	return (
		<div
			className={fullWidth ? `${style.root} ${style.fullWidth}` : style.root}
			ref={rootRef}
		>
			<button
				aria-controls={panelId}
				aria-expanded={isOpen}
				aria-label={`Add ${calendarEvent.title} to calendar`}
				className={style.trigger}
				onClick={() => setIsOpen((current) => !current)}
				ref={triggerRef}
				type="button"
			>
				Add to calendar
				<ChevronDown aria-hidden="true" className={style.chevron} />
			</button>

			{isOpen && (
				<div className={style.panel} id={panelId}>
					<ul
						aria-label={`Calendar options for ${calendarEvent.title}`}
						className={style.options}
					>
						<li>
							<a
								className={style.option}
								href={createGoogleCalendarUrl(calendarEvent)}
								onClick={closeAndRestoreFocus}
								rel="noopener noreferrer"
								target="_blank"
							>
								Add to Google Calendar
								<ExternalLink aria-hidden="true" className={style.optionIcon} />
							</a>
						</li>
						<li>
							<button
								className={style.option}
								onClick={downloadIcs}
								type="button"
							>
								Download as ICS
								<Download aria-hidden="true" className={style.optionIcon} />
							</button>
						</li>
					</ul>
				</div>
			)}
		</div>
	);
}
