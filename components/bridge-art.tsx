import Image from "next/image";
import bridgeArt from "../bridge.svg";
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
			<Image
				alt=""
				className={style.image}
				height={465}
				loading="eager"
				src={bridgeArt}
				width={893}
			/>
		</div>
	);
}
