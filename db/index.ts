import { drizzle } from "drizzle-orm/netlify-db";
import { authRelations } from "@/db/auth-schema";

/**
 * Netlify supplies the connection and selects the appropriate Postgres driver
 * for local development, server mode, and serverless functions.
 */
export const db =
	process.env.BETTER_AUTH_SCHEMA_GENERATION === "1"
		? drizzle.mock({ relations: { ...authRelations } })
		: drizzle({ relations: { ...authRelations } });
