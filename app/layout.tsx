import "./globals.css";
import type { Metadata } from "next";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

const siteOrigin =
	process.env.DEPLOY_PRIME_URL ??
	process.env.DEPLOY_URL ??
	process.env.URL ??
	"http://localhost:3000";

export const metadata: Metadata = {
	metadataBase: new URL(siteOrigin),
	title: {
		default: "SacTech | A tech community for Sacramento",
		template: "%s | SacTech",
	},
	description:
		"SacTech brings together people who design, build, teach, and learn about technology in the Sacramento region.",
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
