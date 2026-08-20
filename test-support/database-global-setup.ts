import { fileURLToPath } from "node:url";
import { NetlifyDB } from "@netlify/database-dev";
import type { TestProject } from "vitest/node";

const migrationsDirectory = fileURLToPath(
	new URL("../netlify/database/migrations", import.meta.url),
);

declare module "vitest" {
	export interface ProvidedContext {
		netlifyDatabaseUrl: string;
	}
}

export default async function setupDatabaseProject(project: TestProject) {
	const database = new NetlifyDB({ logger: () => undefined });

	async function rebuildDatabase() {
		await database.reset();
		await database.applyMigrations(migrationsDirectory);
	}

	try {
		const databaseUrl = new URL(await database.start());

		// Netlify's build image does not set USER, so do not make pg infer it.
		if (!databaseUrl.username) {
			databaseUrl.username = "postgres";
		}

		await database.applyMigrations(migrationsDirectory);
		project.provide("netlifyDatabaseUrl", databaseUrl.href);
		project.onTestsRerun(async (testFiles) => {
			if (testFiles.some((testFile) => testFile.project === project)) {
				await rebuildDatabase();
			}
		});
	} catch (setupError) {
		try {
			await database.stop();
		} catch {
			// Keep the original setup failure as the actionable error.
		}

		throw setupError;
	}

	return async () => {
		await database.stop();
	};
}
