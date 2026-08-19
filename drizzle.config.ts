import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	out: "./netlify/database/migrations",
	schema: ["./db/auth-schema.ts", "./db/schema.ts"],
});
