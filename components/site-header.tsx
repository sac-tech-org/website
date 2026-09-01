import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { SiteNav } from "./site-nav";
import style from "./site-header.module.css";

function SiteNavFallback() {
	return (
		<nav aria-label="Primary" className={style.nav}>
			<ul>
				<li>
					<Link className={style.navLink} href="/#community">
						Community
					</Link>
				</li>
				<li>
					<Link className={style.navLink} href="/events">
						Events
					</Link>
				</li>
				<li>
					<Link className={style.navLink} href="/code-of-conduct">
						Code of Conduct
					</Link>
				</li>
			</ul>
		</nav>
	);
}

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
				<Suspense fallback={<SiteNavFallback />}>
					<SiteNav />
				</Suspense>
				<Link className={style.joinLink} href="/#join">
					Join the community
				</Link>
			</div>
		</header>
	);
}
