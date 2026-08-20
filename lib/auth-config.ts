import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";
import { after } from "next/server";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import {
	sendPasswordResetEmail,
	sendVerificationEmail,
} from "@/lib/auth-email";
import { getAuthBaseUrlConfig } from "@/lib/auth-environment";
import {
	ADMIN_AUTH_ROLES,
	authAccessControl,
	authRoles,
	DEFAULT_AUTH_ROLE,
} from "@/lib/auth-permissions";

const AUTH_LINK_EXPIRY_SECONDS = 60 * 60;

async function deliverAuthEmail(
	kind: "password reset" | "verification",
	deliver: () => Promise<void>,
) {
	try {
		await deliver();
	} catch (error) {
		// These hooks are reachable from unauthenticated endpoints. Keep their
		// responses generic even when Resend or its configuration is unavailable.
		// Recipient addresses and action URLs must not be written to logs.
		console.error(
			`Failed to deliver ${kind} email. Check the server email configuration and Resend logs.`,
			{ errorType: error instanceof Error ? error.name : typeof error },
		);
	}
}

export const auth = betterAuth({
	appName: "SacTech",
	baseURL: getAuthBaseUrlConfig(),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: authSchema,
	}),
	advanced: {
		backgroundTasks: {
			handler: (promise) => {
				after(async () => {
					await promise;
				});
			},
		},
		database: {
			joins: true,
		},
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 10,
		requireEmailVerification: true,
		resetPasswordTokenExpiresIn: AUTH_LINK_EXPIRY_SECONDS,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: async ({ url, user }) => {
			await deliverAuthEmail("password reset", async () => {
				await sendPasswordResetEmail({
					to: user.email,
					url,
					userName: user.name,
				});
			});
		},
	},
	emailVerification: {
		autoSignInAfterVerification: true,
		expiresIn: AUTH_LINK_EXPIRY_SECONDS,
		sendOnSignIn: true,
		sendOnSignUp: true,
		sendVerificationEmail: async ({ url, user }) => {
			await deliverAuthEmail("verification", async () => {
				await sendVerificationEmail({
					to: user.email,
					url,
					userName: user.name,
				});
			});
		},
	},
	plugins: [
		admin({
			ac: authAccessControl,
			adminRoles: ADMIN_AUTH_ROLES,
			defaultRole: DEFAULT_AUTH_ROLE,
			roles: authRoles,
		}),
	],
});

export type AuthSession = typeof auth.$Infer.Session;
