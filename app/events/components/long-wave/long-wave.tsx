import style from "./long-wave.module.css";

export function LongWave() {
	return (
		<div aria-hidden="true" className={style.wave}>
			<div className={style.waveTrack} />
		</div>
	);
}
