import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ResetPasswordForm } from "./reset-password-form";

const { resetPassword } = vi.hoisted(() => ({
	resetPassword: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { resetPassword },
}));

// next/link depends on Next's runtime router context, which this browser-level
// component test intentionally does not boot.
vi.mock("next/link", () => ({
	__esModule: true,
	default: ({ children, ...props }: ComponentProps<"a">) => (
		<a {...props}>{children}</a>
	),
}));

const VALID_TOKEN = "valid-reset-token";
const VALID_PASSWORD = "correct horse battery staple";

async function fillPasswords(
	user: ReturnType<typeof userEvent.setup>,
	newPassword: string,
	confirmation = newPassword,
) {
	await user.fill(screen.getByLabelText("New password"), newPassword);
	await user.fill(screen.getByLabelText("Confirm new password"), confirmation);
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: "Reset password" }));
}

describe("ResetPasswordForm", () => {
	beforeEach(() => {
		resetPassword.mockReset();
	});

	it("resets the password with the URL token and shows a sign-in link", async () => {
		const user = userEvent.setup();
		resetPassword.mockResolvedValue({ error: null });

		render(<ResetPasswordForm error={null} token={VALID_TOKEN} />);
		await fillPasswords(user, VALID_PASSWORD);
		await submit(user);

		await waitFor(() =>
			expect(resetPassword).toHaveBeenCalledWith({
				newPassword: VALID_PASSWORD,
				token: VALID_TOKEN,
			}),
		);
		expect(screen.getByRole("status")).toHaveTextContent(
			"You can now sign in to SacTech with your new password.",
		);
		expect(
			screen.getByRole("heading", { name: "Your password has been reset" }),
		).toBeVisible();
		expect(
			screen.getByRole("link", { name: /Back to sign in/ }),
		).toHaveAttribute("href", "/auth");
	});

	it("validates password length before crossing the auth boundary", async () => {
		const user = userEvent.setup();
		render(<ResetPasswordForm error={null} token={VALID_TOKEN} />);

		await fillPasswords(user, "too short");
		await submit(user);

		const newPassword = screen.getByLabelText("New password");
		expect(newPassword).toHaveAttribute("minlength", "10");
		expect(newPassword).toHaveAttribute("maxlength", "128");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Your password must be at least 10 characters.",
		);
		expect(newPassword).toHaveAttribute("aria-invalid", "true");
		expect(newPassword).toHaveAccessibleDescription(
			"10–128 characters. Your password must be at least 10 characters.",
		);
		await waitFor(() => expect(newPassword).toHaveFocus());
		expect(resetPassword).not.toHaveBeenCalled();
	});

	it("requires both password entries to match", async () => {
		const user = userEvent.setup();
		render(<ResetPasswordForm error={null} token={VALID_TOKEN} />);

		await fillPasswords(user, VALID_PASSWORD, "a different password");
		await submit(user);

		const confirmation = screen.getByLabelText("Confirm new password");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"The passwords don't match.",
		);
		expect(confirmation).toHaveAttribute("aria-invalid", "true");
		expect(confirmation).toHaveAccessibleDescription(
			"The passwords don't match.",
		);
		await waitFor(() => expect(confirmation).toHaveFocus());
		expect(resetPassword).not.toHaveBeenCalled();
	});

	it("does not render password fields for missing or rejected URL tokens", () => {
		const { rerender } = render(
			<ResetPasswordForm error={null} token={null} />,
		);

		expect(screen.getByText(/missing its token/i)).toBeVisible();
		expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /Back to sign in/ }),
		).toHaveAttribute("href", "/auth");

		rerender(<ResetPasswordForm error="INVALID_TOKEN" token={VALID_TOKEN} />);
		expect(screen.getByText(/invalid or has expired/i)).toBeVisible();
		expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
	});

	it("retires a reset form when the account service rejects its token", async () => {
		const user = userEvent.setup();
		resetPassword.mockResolvedValue({
			error: { code: "INVALID_TOKEN", message: "Invalid token" },
		});
		render(<ResetPasswordForm error={null} token={VALID_TOKEN} />);

		await fillPasswords(user, VALID_PASSWORD);
		await submit(user);

		expect(await screen.findByText(/invalid or has expired/i)).toBeVisible();
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: "Request a new reset link" }),
			).toHaveFocus(),
		);
		expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
		expect(resetPassword).toHaveBeenCalledOnce();
	});

	it("shows retryable service and connection errors without clearing the form", async () => {
		const user = userEvent.setup();
		resetPassword.mockResolvedValueOnce({
			error: { code: "SERVICE_UNAVAILABLE" },
		});
		render(<ResetPasswordForm error={null} token={VALID_TOKEN} />);
		await fillPasswords(user, VALID_PASSWORD);
		await submit(user);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"We couldn't reset your password. Try again.",
		);
		expect(screen.getByLabelText("New password")).toHaveValue(VALID_PASSWORD);
		expect(screen.getByLabelText("New password")).not.toHaveAttribute(
			"aria-invalid",
		);

		resetPassword.mockRejectedValueOnce(new Error("offline"));
		await submit(user);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"We couldn't connect to the account service. Check your connection and try again.",
		);
		expect(resetPassword).toHaveBeenCalledTimes(2);
	});
});
