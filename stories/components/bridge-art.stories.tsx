import preview from "@/.storybook/preview";
import { BridgeArt } from "@/components/bridge-art";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Components/Bridge Art",
	component: BridgeArt,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	decorators: [
		(Story) => (
			<div style={{ width: "min(56rem, calc(100vw - 2rem))" }}>
				<Story />
			</div>
		),
	],
});

export const Full = meta.story({
	args: {
		compact: false,
	},
	play: async ({ canvasElement }) => {
		const artwork = canvasElement.querySelector("[aria-hidden='true']");
		const image = canvasElement.querySelector("img");

		await expect(artwork).toHaveAttribute("aria-hidden", "true");
		await expect(image).toBeInTheDocument();
	},
});

export const Compact = Full.extend({
	args: {
		compact: true,
	},
});
