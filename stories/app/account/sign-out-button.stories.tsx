import preview from "@/.storybook/preview";
import { SignOutButton } from "@/app/account/sign-out-button";
import { authClient } from "@/lib/auth-client";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	component: SignOutButton,
	parameters: {
		layout: "centered",
	},
});

export const Idle = meta.story({
	beforeEach: () => {
		mocked(authClient.signOut).mockResolvedValue({
			data: null,
			error: null,
		});
	},
});

export const ServiceError = Idle.extend({
	beforeEach: () => {
		mocked(authClient.signOut).mockResolvedValue({
			data: null,
			error: {
				code: "SESSION_REVOKE_FAILED",
				message: "The session could not be revoked.",
				status: 500,
				statusText: "Internal Server Error",
			},
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"session could not be revoked",
		);
	},
});

export const NetworkError = Idle.extend({
	beforeEach: () => {
		mocked(authClient.signOut).mockRejectedValue(new Error("offline"));
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"couldn't connect",
		);
	},
});

export const SigningOut = Idle.extend({
	beforeEach: () => {
		mocked(authClient.signOut).mockImplementation(() => new Promise(() => {}));
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Sign out" }));
		await expect(
			canvas.getByRole("button", { name: "Signing out…" }),
		).toBeDisabled();
	},
});
