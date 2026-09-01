import { fn } from "storybook/test";

interface SessionLike {
	user: {
		role?: string | null;
	};
}

function rolesFor(session: SessionLike | null) {
	return new Set(
		session?.user.role
			?.split(",")
			.map((role) => role.trim())
			.filter(Boolean) ?? ["submitter"],
	);
}

export const getCurrentSession = fn(async () => null);
export const requireSession = fn(async () => null);
export const requireAdminSession = fn(async () => null);
export const requireEventReviewerSession = fn(async () => null);

export const sessionIsAdmin = fn((session: SessionLike | null) =>
	rolesFor(session).has("admin"),
);

export const sessionCanSubmitEvents = fn(
	(session: SessionLike | null) => session !== null,
);

export const sessionCanCancelOwnEvents = fn(
	(session: SessionLike | null) => session !== null,
);

export const sessionCanReviewEvents = fn((session: SessionLike | null) => {
	const roles = rolesFor(session);
	return roles.has("admin") || roles.has("approver");
});

export const sessionCanManageUsers = fn((session: SessionLike | null) =>
	rolesFor(session).has("admin"),
);
