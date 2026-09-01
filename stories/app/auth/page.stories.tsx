import preview from "@/.storybook/preview";
import AuthPage from "@/app/auth/page";
import { isEmailDeliveryEnabled } from "@/lib/email-delivery";
import { getCurrentSession } from "@/lib/session";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Auth/Sign In",
	component: AuthPage,
	parameters: {
		layout: "fullscreen",
	},
});

export const SignedOut = meta.story({
	beforeEach: () => {
		mocked(getCurrentSession).mockResolvedValue(null);
		mocked(isEmailDeliveryEnabled).mockReturnValue(true);
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "Share a local tech event." }),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Welcome back" }),
		).toBeVisible();
	},
});

export const EmailDeliveryDisabled = SignedOut.extend({
	beforeEach: () => {
		mocked(getCurrentSession).mockResolvedValue(null);
		mocked(isEmailDeliveryEnabled).mockReturnValue(false);
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "Welcome back" }),
		).toBeVisible();
		await expect(
			canvas.queryByRole("button", { name: "Forgot your password?" }),
		).not.toBeInTheDocument();
	},
});

export const Loading = SignedOut.extend({
	beforeEach: () => {
		mocked(getCurrentSession).mockImplementation(() => new Promise(() => {}));
		mocked(isEmailDeliveryEnabled).mockReturnValue(true);
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", { name: "Checking your account" }),
		).toBeVisible();
	},
});
