import preview from "@/.storybook/preview";
import { ResetPasswordForm } from "@/app/auth/reset-password/reset-password-form";
import { authClient } from "@/lib/auth-client";
import { expect, mocked } from "storybook/test";

const TOKEN = "storybook-reset-token";
const PASSWORD = "correct horse battery staple";

const meta = preview.meta({
	title: "Auth/Forms/Reset Password Form",
	component: ResetPasswordForm,
	parameters: {
		layout: "centered",
	},
	args: {
		error: null,
		token: TOKEN,
	},
	decorators: [
		(Story) => (
			<div
				style={{
					background: "var(--color-paper)",
					padding: "2rem",
					width: "min(32rem, calc(100vw - 2rem))",
				}}
			>
				<Story />
			</div>
		),
	],
});

export const ValidToken = meta.story({
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", { name: "Reset your password" }),
		).toBeVisible();
		await expect(canvas.getByLabelText("New password")).toBeEnabled();
	},
});

export const MissingToken = ValidToken.extend({
	args: {
		token: null,
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText(/missing its token/i)).toBeVisible();
		await expect(
			canvas.queryByLabelText("New password"),
		).not.toBeInTheDocument();
	},
});

export const InvalidToken = ValidToken.extend({
	args: {
		error: "INVALID_TOKEN",
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText(/invalid or has expired/i)).toBeVisible();
		await expect(
			canvas.queryByLabelText("New password"),
		).not.toBeInTheDocument();
	},
});

export const PasswordTooShort = ValidToken.extend({
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("New password"), "too short");
		await userEvent.type(
			canvas.getByLabelText("Confirm new password"),
			"too short",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Reset password" }),
		);

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"Your password must be at least 10 characters.",
		);
	},
});

export const PasswordsDoNotMatch = ValidToken.extend({
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("New password"), PASSWORD);
		await userEvent.type(
			canvas.getByLabelText("Confirm new password"),
			"a different secure password",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Reset password" }),
		);

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"The passwords don't match.",
		);
	},
});

export const ResettingPassword = ValidToken.extend({
	beforeEach: () => {
		mocked(authClient.resetPassword).mockImplementation(
			() => new Promise(() => {}),
		);
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("New password"), PASSWORD);
		await userEvent.type(
			canvas.getByLabelText("Confirm new password"),
			PASSWORD,
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Reset password" }),
		);

		await expect(
			canvas.getByRole("button", { name: "Resetting password…" }),
		).toBeDisabled();
	},
});

export const PasswordReset = ValidToken.extend({
	beforeEach: () => {
		mocked(authClient.resetPassword).mockResolvedValue({
			data: null,
			error: null,
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("New password"), PASSWORD);
		await userEvent.type(
			canvas.getByLabelText("Confirm new password"),
			PASSWORD,
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Reset password" }),
		);

		await expect(
			await canvas.findByRole("heading", {
				name: "Your password has been reset",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: /Back to sign in/ }),
		).toHaveAttribute("href", "/auth");
	},
});

export const ServiceError = ValidToken.extend({
	beforeEach: () => {
		mocked(authClient.resetPassword).mockResolvedValue({
			data: null,
			error: {
				code: "SERVICE_UNAVAILABLE",
				message: "We couldn't reset your password. Try again.",
				status: 503,
				statusText: "Service Unavailable",
			},
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("New password"), PASSWORD);
		await userEvent.type(
			canvas.getByLabelText("Confirm new password"),
			PASSWORD,
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Reset password" }),
		);

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"We couldn't reset your password. Try again.",
		);
		await expect(canvas.getByLabelText("New password")).toHaveValue(PASSWORD);
	},
});

export const ServiceRejectsToken = ValidToken.extend({
	beforeEach: () => {
		mocked(authClient.resetPassword).mockResolvedValue({
			data: null,
			error: {
				code: "TOKEN_EXPIRED",
				message: "The reset token expired.",
				status: 400,
				statusText: "Bad Request",
			},
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText("New password"), PASSWORD);
		await userEvent.type(
			canvas.getByLabelText("Confirm new password"),
			PASSWORD,
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Reset password" }),
		);

		await expect(
			await canvas.findByRole("heading", {
				name: "Request a new reset link",
			}),
		).toBeVisible();
	},
});
