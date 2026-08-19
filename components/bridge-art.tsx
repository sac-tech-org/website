import style from "./bridge-art.module.css";

interface BridgeArtProps {
	compact?: boolean;
	className?: string;
}

export function BridgeArt({ compact = false, className = "" }: BridgeArtProps) {
	return (
		<div
			aria-hidden="true"
			className={`${style.art} ${compact ? style.compact : ""} ${className}`}
		>
			<span className={style.sun} />
			<div className={style.bridge}>
				<span className={style.span} />
				<span className={`${style.tower} ${style.towerLeft}`}>
					<span className={style.windows} />
					<span className={style.brace} />
				</span>
				<span className={`${style.tower} ${style.towerRight}`}>
					<span className={style.windows} />
					<span className={style.brace} />
				</span>
			</div>
			<div className={style.water}>
				<span />
				<span />
				<span />
			</div>
		</div>
	);
}
