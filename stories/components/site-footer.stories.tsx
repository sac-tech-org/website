import preview from "@/.storybook/preview";
import { SiteFooter } from "@/components/site-footer";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Components/Site Footer",
	component: SiteFooter,
	parameters: {
		layout: "fullscreen",
		nextjs: {
			appDirectory: true,
		},
	},
	tags: ["autodocs"],
});

export const Default = meta.story({
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("contentinfo")).toBeVisible();
		await expect(canvas.getByAltText("SacTech")).toBeVisible();
		await expect(canvas.getAllByRole("link")).toHaveLength(3);
		await expect(
			canvas.getByRole("navigation", { name: "Footer" }),
		).toBeVisible();
	},
});
