import { globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defaultExclude, defineConfig } from "vitest/config";

const projectResolve = {
	alias: [
		{
			find: /^@\//,
			replacement: fileURLToPath(new URL("./", import.meta.url)),
		},
	],
	tsconfigPaths: true,
};
const databaseIntegrationTestPattern = "**/*.integration.test.ts";
const projectRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
	plugins: [react()],
	resolve: projectResolve,
	test: {
		clearMocks: true,
		restoreMocks: true,
		watchTriggerPatterns: [
			{
				pattern: /\/netlify\/database\/migrations\/.*\.sql$/,
				testsToRun: () =>
					globSync(databaseIntegrationTestPattern, {
						cwd: projectRoot,
						exclude: defaultExclude,
					}),
			},
		],
		projects: [
			{
				resolve: projectResolve,
				test: {
					name: "node",
					include: ["**/*.test.ts"],
					exclude: [...defaultExclude, databaseIntegrationTestPattern],
					environment: "node",
					sequence: { groupOrder: 0 },
				},
			},
			{
				resolve: projectResolve,
				test: {
					name: "database",
					include: [databaseIntegrationTestPattern],
					environment: "node",
					globalSetup: ["./test-support/database-global-setup.ts"],
					setupFiles: ["./test-support/database-setup.ts"],
					// The project shares one migrated database. Keep files isolated and
					// sequential so each can reset the schema data before it runs.
					fileParallelism: false,
					isolate: true,
					sequence: { groupOrder: 1 },
				},
			},
			{
				resolve: projectResolve,
				test: {
					name: "browser",
					include: ["**/*.integration.test.tsx"],
					setupFiles: ["./vitest.setup.ts"],
					sequence: { groupOrder: 0 },
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
