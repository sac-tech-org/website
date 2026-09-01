import preview from "@/.storybook/preview";
import { VerifyEmailResult } from "@/app/auth/verify-email/verification-result";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Auth/Results/Email Verification",
	component: VerifyEmailResult,
	parameters: {
		controls: { disable: true },
		layout: "centered",
	},
	args: {
		searchParams: Promise.resolve({ error: "TOKEN_EXPIRED" }),
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

export const Expired = meta.story({
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "Verification link expired",
			}),
		).toBeVisible();
		await expect(canvas.getByRole("alert")).toHaveTextContent("has expired");
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
		await expect(canvas.getByRole("alert")).toHaveTextContent(
			"invalid or has already been used",
		);
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
		await expect(
			canvas.getByRole("link", { name: /Back to sign in/ }),
		).toHaveAttribute("href", "/auth");
	},
});
