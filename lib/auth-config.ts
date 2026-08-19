import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { getAuthBaseUrlConfig } from "@/lib/auth-environment";

export const auth = betterAuth({
	appName: "SacTech",
	baseURL: getAuthBaseUrlConfig(),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
	}),
	advanced: {
		database: {
			joins: true,
		},
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
	},
	plugins: [admin()],
});

export type AuthSession = typeof auth.$Infer.Session;
