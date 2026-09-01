import { definePreview } from "@storybook/nextjs-vite";

export default definePreview({
    parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},

    addons: []
});
