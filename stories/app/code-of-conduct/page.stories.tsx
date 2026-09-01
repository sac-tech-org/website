import preview from "@/.storybook/preview";
import CodeOfConductPage from "@/app/code-of-conduct/page";

const meta = preview.meta({
	component: CodeOfConductPage,
	title: "Pages/Code of Conduct",
	parameters: {
		layout: "fullscreen",
	},
});

export const FullPolicy = meta.story({});
