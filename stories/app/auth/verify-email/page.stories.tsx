import preview from "@/.storybook/preview";
import VerifyEmailPage from "@/app/auth/verify-email/page";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Auth/Verify Email",
	component: VerifyEmailPage,
	parameters: {
		controls: { disable: true },
		layout: "fullscreen",
	},
	args: {
		searchParams: Promise.resolve({ error: "TOKEN_EXPIRED" }),
	},
});

export const Expired = meta.story({
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "Verify your email." }),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Verification link expired" }),
		).toBeVisible();
	},
});

export const Invalid = Expired.extend({
	args: {
		searchParams: Promise.resolve({ error: "INVALID_TOKEN" }),
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "Verification link unavailable",
			}),
		).toBeVisible();
	},
});

export const GenericFailure = Expired.extend({
	args: {
		searchParams: Promise.resolve({ error: "USER_NOT_FOUND" }),
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "We couldn't verify your email",
			}),
		).toBeVisible();
	},
});

export const Loading = Expired.extend({
	args: {
		searchParams: new Promise(() => {}),
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "Checking your verification link",
			}),
		).toBeVisible();
	},
});
