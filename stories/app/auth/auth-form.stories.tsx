import preview from "@/.storybook/preview";
import { AuthForm } from "@/app/auth/auth-form";
import { authClient } from "@/lib/auth-client";
import { expect, fireEvent, mocked } from "storybook/test";

const EMAIL = "person@example.com";
const PASSWORD = "correct horse battery staple";

const meta = preview.meta({
	title: "Auth/Forms/Auth Form",
	component: AuthForm,
	parameters: {
		layout: "centered",
	},
	args: {
		emailDeliveryEnabled: true,
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

export const SignIn = meta.story({
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", { name: "Welcome back" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Sign in", pressed: true }),
		).toBeVisible();
	},
});

export const SignUp = SignIn.extend({
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Create account" }),
		);

		await expect(
			canvas.getByRole("heading", { name: "Create an account" }),
		).toBeVisible();
		await expect(canvas.getByRole("textbox", { name: "Name" })).toBeVisible();
	},
});

export const ForgotPassword = SignIn.extend({
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Forgot your password?" }),
		);

		await expect(
			canvas.getByRole("heading", { name: "Reset your password" }),
		).toBeVisible();
		await expect(canvas.queryByLabelText("Password")).not.toBeInTheDocument();
	},
});

export const EmailDeliveryDisabled = SignIn.extend({
	args: {
		emailDeliveryEnabled: false,
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.queryByRole("button", { name: "Forgot your password?" }),
		).not.toBeInTheDocument();
	},
});

export const ValidationError = SignIn.extend({
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Email address" }),
			EMAIL,
		);
		await userEvent.type(canvas.getByLabelText("Password"), "too short");

		fireEvent.submit(canvasElement.querySelector("form")!);

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"Your password must be at least 10 characters.",
		);
		await expect(canvas.getByLabelText("Password")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
	},
});

export const SigningIn = SignIn.extend({
	beforeEach: () => {
		mocked(authClient.signIn.email).mockImplementation(
			() => new Promise(() => {}),
		);
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Email address" }),
			EMAIL,
		);
		await userEvent.type(canvas.getByLabelText("Password"), PASSWORD);
		await userEvent.click(
			canvas.getAllByRole("button", { name: "Sign in" }).at(-1)!,
		);

		await expect(
			canvas.getByRole("button", { name: "Signing in…" }),
		).toBeDisabled();
	},
});

export const SignInServiceError = SignIn.extend({
	beforeEach: () => {
		mocked(authClient.signIn.email).mockResolvedValue({
			data: null,
			error: {
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
				status: 401,
				statusText: "Unauthorized",
			},
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Email address" }),
			EMAIL,
		);
		await userEvent.type(canvas.getByLabelText("Password"), PASSWORD);
		await userEvent.click(
			canvas.getAllByRole("button", { name: "Sign in" }).at(-1)!,
		);

		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			"That email and password don't match.",
		);
		await expect(
			canvas.getByRole("textbox", { name: "Email address" }),
		).toHaveValue(EMAIL);
	},
});

export const SignUpEmailSent = SignIn.extend({
	beforeEach: () => {
		mocked(authClient.signUp.email).mockResolvedValue({
			data: null,
			error: null,
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Create account" }),
		);
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Name" }),
			"Pat Lee",
		);
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Email address" }),
			EMAIL,
		);
		await userEvent.type(canvas.getByLabelText("Password"), PASSWORD);
		await userEvent.click(
			canvas.getAllByRole("button", { name: "Create account" }).at(-1)!,
		);

		await expect(
			await canvas.findByRole("heading", { name: "Check your email" }),
		).toBeVisible();
		await expect(canvas.getByRole("status")).toHaveTextContent(
			"we'll send a verification link shortly",
		);
	},
});

export const PasswordResetEmailSent = SignIn.extend({
	beforeEach: () => {
		mocked(authClient.requestPasswordReset).mockResolvedValue({
			data: null,
			error: null,
		});
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Forgot your password?" }),
		);
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Email address" }),
			EMAIL,
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Send reset link" }),
		);

		await expect(await canvas.findByRole("status")).toHaveTextContent(
			"If an account exists for that address",
		);
	},
});
