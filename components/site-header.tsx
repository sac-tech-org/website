import Link from "next/link";
import { SiteNav } from "./site-nav";
import style from "./site-header.module.css";

export function SiteHeader() {
	return (
		<header className={style.header}>
			<div className={style.inner}>
				<Link aria-label="SacTech home" className={style.brand} href="/">
					<span>SAC</span>
					<span aria-hidden="true" className={style.mark}>
						<span />
					</span>
					<span>TECH</span>
				</Link>
				<SiteNav />
				<Link className={style.joinLink} href="/#join">
					Join the community
				</Link>
			</div>
		</header>
	);
}
