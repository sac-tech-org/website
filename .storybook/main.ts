import { defineMain } from "@storybook/nextjs-vite/node";
export default defineMain({
	stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	addons: ["@storybook/addon-mcp"],
	framework: "@storybook/nextjs-vite",
	staticDirs: ["../public"],
});
