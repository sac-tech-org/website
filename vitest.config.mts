import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const projectResolve = {
	alias: [
		{
			find: /^@\//,
			replacement: fileURLToPath(new URL("./", import.meta.url)),
		},
	],
	tsconfigPaths: true,
};

export default defineConfig({
	plugins: [react()],
	resolve: projectResolve,
	test: {
		clearMocks: true,
		restoreMocks: true,
		projects: [
			{
				resolve: projectResolve,
				test: {
					name: "node",
					include: ["**/*.test.ts"],
					environment: "node",
				},
			},
			{
				resolve: projectResolve,
				test: {
					name: "browser",
					include: ["**/*.integration.test.tsx"],
					setupFiles: ["./vitest.setup.ts"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: "chromium" }],
						viewport: { width: 1280, height: 720 },
					},
				},
			},
		],
	},
});
