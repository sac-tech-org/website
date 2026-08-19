import Link from "next/link";
import style from "./site-footer.module.css";

export function SiteFooter() {
	return (
		<footer className={style.footer}>
			<div aria-hidden="true" className={style.truss} />
			<div className={style.inner}>
				<div>
					<p className={style.wordmark}>SAC TECH</p>
					<p className={style.tagline}>Sacramento tech, built together.</p>
				</div>
				<nav aria-label="Footer" className={style.nav}>
					<Link href="/#community">Community</Link>
					<Link href="/events">Events</Link>
					<Link href="/code-of-conduct">Code of Conduct</Link>
				</nav>
			</div>
		</footer>
	);
}
