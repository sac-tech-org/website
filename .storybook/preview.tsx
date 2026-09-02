import { definePreview } from "@storybook/nextjs-vite";
import { sb } from "storybook/test";
import "../app/globals.css";

sb.mock(import("../lib/session.ts"));
sb.mock(import("../lib/events/queries.ts"));
sb.mock(import("../lib/events/actions.ts"));
sb.mock(import("../lib/auth-client.ts"));
sb.mock(import("../lib/auth-config.ts"));
sb.mock(import("../lib/email-delivery.ts"));
sb.mock(import("../app/admin/users/actions.ts"));

export default definePreview({
	addons: [],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		layout: "fullscreen",
		react: {
			rsc: true,
		},
		nextjs: {
			appDirectory: true,
		},
	},
});
