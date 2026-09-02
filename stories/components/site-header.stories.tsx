import preview from "@/.storybook/preview";
import { SiteHeader } from "@/components/site-header";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Components/Site Header",
	component: SiteHeader,
	parameters: {
		layout: "fullscreen",
		nextjs: {
			appDirectory: true,
			navigation: {
				pathname: "/",
			},
		},
	},
	tags: ["autodocs"],
});

export const HomeRoute = meta.story({
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("banner").querySelector("img"),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("link", { name: "Community" }),
		).toHaveAttribute("aria-current", "page");
		await expect(
			canvas.getByRole("link", { name: "Join the community" }),
		).toHaveAttribute("href", "/#join");
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
