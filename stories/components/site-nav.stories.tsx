import preview from "@/.storybook/preview";
import { SiteNav } from "@/components/site-nav";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Components/Site Navigation",
	component: SiteNav,
	parameters: {
		layout: "centered",
		nextjs: {
			appDirectory: true,
			navigation: {
				pathname: "/",
			},
		},
	},
	tags: ["autodocs"],
	decorators: [
		(Story) => (
			<div
				style={{
					background: "var(--color-cream)",
					padding: "1rem 2rem",
				}}
			>
				<Story />
			</div>
		),
	],
});

export const HomeRoute = meta.story({
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("link", { name: "Community" }),
		).toHaveAttribute("aria-current", "page");
	},
});

export const EventsRoute = HomeRoute.extend({
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/events",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link", { name: "Events" })).toHaveAttribute(
			"aria-current",
			"page",
		);
	},
});

export const CodeOfConductRoute = HomeRoute.extend({
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/code-of-conduct",
			},
		},
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("link", { name: "Code of Conduct" }),
		).toHaveAttribute("aria-current", "page");
	},
});

export const UnmatchedRoute = HomeRoute.extend({
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/account",
			},
		},
	},
	play: async ({ canvas }) => {
		for (const link of canvas.getAllByRole("link")) {
			await expect(link).not.toHaveAttribute("aria-current");
		}
	},
});
