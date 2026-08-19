import style from "./event-chip.module.css";

interface BaseEventChipProps {
	size: "default" | "compact";
}

interface InPersonChipProps extends BaseEventChipProps {
	variant: "in-person";
}

interface OnlineChipProps extends BaseEventChipProps {
	variant: "online";
}

interface RecurringChipProps extends BaseEventChipProps {
	every: "day" | "week" | "month" | "year";
	variant: "recurring";
}

type EventChipProps =
	| InPersonChipProps
	| OnlineChipProps
	| RecurringChipProps;

export function EventChip(props: EventChipProps) {
	const label =
		props.variant === "recurring"
			? `Every ${props.every}`
			: props.variant === "in-person"
				? "In person"
				: "Online";

	return (
		<span
			className={`${style.container} ${style[props.variant]} ${style[props.size]}`}
		>
			<span aria-hidden="true" className={style.dot} />
			{label}
		</span>
	);
}
