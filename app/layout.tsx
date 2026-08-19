import "./globals.css";
import type { Metadata } from "next";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

export const metadata: Metadata = {
	title: {
		default: "SacTech — Sacramento tech, built together",
		template: "%s | SacTech",
	},
	description:
		"A welcoming home for the people who design, build, teach, and grow technology in the Sacramento region.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<a className="skipLink" href="#main-content">
					Skip to main content
				</a>
				<SiteHeader />
				{children}
				<SiteFooter />
			</body>
		</html>
	);
}
