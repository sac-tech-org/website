import Image from "next/image";
import Link from "next/link";
import style from "./site-footer.module.css";

export function SiteFooter() {
	return (
		<footer className={style.footer}>
			<div className={style.scene}>
				<div aria-hidden="true" className={style.artwork}>
					<Image
						alt=""
						className={style.city}
						height={111}
						src="/images/footer/city-outline.svg"
						width={200}
					/>
					<Image
						alt=""
						className={style.flower}
						height={200}
						src="/images/footer/flower.svg"
						width={108}
					/>
				</div>
				<div className={style.inner}>
					<div>
						<Image
							alt="SacTech"
							className={style.logo}
							height={80}
							src="/sactech_sticker.png"
							width={80}
						/>
						<p className={style.tagline}>A tech community for Sacramento.</p>
					</div>
					<nav aria-label="Footer" className={style.nav}>
						<Link href="/#community">Community</Link>
						<Link href="/events">Events</Link>
						<Link href="/code-of-conduct">Code of Conduct</Link>
					</nav>
				</div>
			</div>
			<div aria-hidden="true" className={style.truss} />
		</footer>
	);
}
