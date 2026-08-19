import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";

function getConfiguredAuthHosts() {
	const hosts = (process.env.BETTER_AUTH_ALLOWED_HOSTS ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean);

	if (process.env.BETTER_AUTH_URL) {
		try {
			hosts.push(new URL(process.env.BETTER_AUTH_URL).host);
		} catch {
			// Better Auth will surface the invalid URL during startup.
		}
	}

	if (hosts.length === 0) {
		hosts.push(
			"localhost:3000",
			"localhost:8888",
			"127.0.0.1:3000",
			"127.0.0.1:8888",
		);
	}

	return [...new Set(hosts)];
}

export const auth = betterAuth({
	appName: "SacTech",
	baseURL: {
		allowedHosts: getConfiguredAuthHosts(),
		...(process.env.BETTER_AUTH_URL
			? { fallback: process.env.BETTER_AUTH_URL }
			: {}),
		protocol: process.env.NODE_ENV === "production" ? "https" : "http",
	},
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
