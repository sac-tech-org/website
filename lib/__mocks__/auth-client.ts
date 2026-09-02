import { fn } from "storybook/test";

const successfulResult = () => ({ data: null, error: null });

export const authClient = {
	requestPasswordReset: fn(async () => successfulResult()),
	resetPassword: fn(async () => successfulResult()),
	signIn: {
		email: fn(async () => successfulResult()),
	},
	signOut: fn(async () => successfulResult()),
	signUp: {
		email: fn(async () => successfulResult()),
	},
};
