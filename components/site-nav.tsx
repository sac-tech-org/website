"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import style from "./site-header.module.css";

const links = [
	{ href: "/#community", label: "Community", path: "/" },
	{ href: "/events", label: "Events", path: "/events" },
	{
		href: "/code-of-conduct",
		label: "Code of Conduct",
		path: "/code-of-conduct",
	},
];

export function SiteNav() {
	const pathname = usePathname();

	return (
		<nav aria-label="Primary" className={style.nav}>
			<ul>
				{links.map((link) => {
					const isCurrent = pathname === link.path;

					return (
						<li key={link.href}>
							<Link
								aria-current={isCurrent ? "page" : undefined}
								className={style.navLink}
								href={link.href}
							>
								{link.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
