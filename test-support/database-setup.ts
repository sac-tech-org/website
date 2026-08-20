import { afterAll, beforeAll, inject } from "vitest";
import { testDatabase } from "@/test-support/database-client";

process.env.NETLIFY_DB_DRIVER = "server";
process.env.NETLIFY_DB_URL = inject("netlifyDatabaseUrl");

beforeAll(async () => {
	await testDatabase.resetPublicTables();
});

afterAll(async () => {
	await testDatabase.close();
});
