import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "./site-nav";
import style from "./site-header.module.css";

export function SiteHeader() {
	return (
		<header className={style.header}>
			<div className={style.inner}>
				<Link aria-label="SacTech home" className={style.brand} href="/">
					<Image
						alt=""
						className={style.logo}
						height={72}
						loading="eager"
						src="/sactech_sticker.png"
						width={72}
					/>
				</Link>
				<SiteNav />
				<Link className={style.joinLink} href="/#join">
					Join the community
				</Link>
			</div>
		</header>
	);
}
