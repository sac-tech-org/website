import { fn } from "storybook/test";

export const auth = {
	api: {
		getSession: fn(async () => null),
		listUsers: fn(async () => ({ total: 0, users: [] })),
	},
};
