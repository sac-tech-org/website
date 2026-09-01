import type { AuthSession } from "@/lib/auth";

interface SessionOptions {
	banned?: boolean;
	email?: string;
	id?: string;
	name?: string;
	role?: string;
}

export function createSession({
	banned = false,
	email = "alex@example.com",
	id = "storybook-user",
	name = "Alex Rivera",
	role = "submitter",
}: SessionOptions = {}): AuthSession {
	const createdAt = new Date("2026-01-15T18:00:00.000Z");
	const updatedAt = new Date("2026-08-20T18:00:00.000Z");

	return {
		session: {
			createdAt,
			expiresAt: new Date("2027-01-15T18:00:00.000Z"),
			id: "storybook-session",
			ipAddress: "127.0.0.1",
			token: "storybook-session-token",
			updatedAt,
			userAgent: "Storybook",
			userId: id,
		},
		user: {
			banExpires: null,
			banReason: null,
			banned,
			createdAt,
			email,
			emailVerified: true,
			id,
			image: null,
			name,
			role,
			updatedAt,
		},
	} as AuthSession;
}
