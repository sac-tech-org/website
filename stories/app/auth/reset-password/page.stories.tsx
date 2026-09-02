import preview from "@/.storybook/preview";
import ResetPasswordPage from "@/app/auth/reset-password/page";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Auth/Reset Password",
	component: ResetPasswordPage,
	parameters: {
		controls: { disable: true },
		layout: "fullscreen",
	},
	args: {
		searchParams: Promise.resolve({ token: "storybook-reset-token" }),
	},
});

export const ValidLink = meta.story({
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "Choose a new password." }),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Reset your password" }),
		).toBeVisible();
	},
});

export const MissingToken = ValidLink.extend({
	args: {
		searchParams: Promise.resolve({}),
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByText(/missing its token/i)).toBeVisible();
	},
});

export const InvalidLink = ValidLink.extend({
	args: {
		searchParams: Promise.resolve({
			error: "INVALID_TOKEN",
			token: "storybook-reset-token",
		}),
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByText(/invalid or has expired/i),
		).toBeVisible();
	},
});

export const Loading = ValidLink.extend({
	args: {
		searchParams: new Promise(() => {}),
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "Checking your reset link" }),
		).toBeVisible();
	},
});
