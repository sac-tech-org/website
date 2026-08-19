import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { AuthForm } from "./auth-form";

const authMocks = vi.hoisted(() => ({
	refresh: vi.fn(),
	replace: vi.fn(),
	signInEmail: vi.fn(),
	signUpEmail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: authMocks.refresh,
		replace: authMocks.replace,
	}),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		signIn: { email: authMocks.signInEmail },
		signUp: { email: authMocks.signUpEmail },
	},
}));

async function fillCredentials(
	user: ReturnType<typeof userEvent.setup>,
	password = "correct horse",
) {
	await user.type(
		screen.getByRole("textbox", { name: "Email address" }),
		"person@example.com",
	);
	await user.type(screen.getByLabelText("Password"), password);
}

describe("AuthForm", () => {
	beforeEach(() => {
		for (const mock of Object.values(authMocks)) {
			mock.mockReset();
		}
	});

	it("signs in with the visible fields and navigates to the account", async () => {
		const user = userEvent.setup();
		authMocks.signInEmail.mockResolvedValue({ error: null });

		render(<AuthForm />);
		expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Sign in", pressed: true }),
		).toBeVisible();

		await fillCredentials(user);
		await user.click(
			screen.getAllByRole("button", { name: "Sign in" }).at(-1)!,
		);

		await waitFor(() =>
			expect(authMocks.signInEmail).toHaveBeenCalledWith({
				email: "person@example.com",
				password: "correct horse",
			}),
		);
		expect(authMocks.signUpEmail).not.toHaveBeenCalled();
		expect(authMocks.replace).toHaveBeenCalledWith("/account");
		expect(authMocks.refresh).toHaveBeenCalledOnce();
	});

	it("shows a friendly sign-in error without clearing entered credentials", async () => {
		const user = userEvent.setup();
		authMocks.signInEmail.mockResolvedValue({
			error: { code: "INVALID_EMAIL_OR_PASSWORD" },
		});

		render(<AuthForm />);
		await fillCredentials(user);
		await user.click(
			screen.getAllByRole("button", { name: "Sign in" }).at(-1)!,
		);

		const message = "That email and password combination did not match.";
		const alert = await screen.findByRole("alert");
		const email = screen.getByRole("textbox", { name: "Email address" });
		const password = screen.getByLabelText("Password");

		expect(alert).toHaveTextContent(message);
		expect(email).toHaveValue("person@example.com");
		expect(password).toHaveValue("correct horse");
		expect(email).toHaveAttribute("aria-invalid", "true");
		expect(password).toHaveAttribute("aria-invalid", "true");
		expect(email).toHaveAccessibleDescription(message);
		expect(password).toHaveAccessibleDescription(
			`At least 10 characters. ${message}`,
		);
		await waitFor(() => expect(email).toHaveFocus());
		expect(authMocks.replace).not.toHaveBeenCalled();

		await user.type(password, "!");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(email).not.toHaveAttribute("aria-invalid");
		expect(password).not.toHaveAttribute("aria-invalid");
	});

	it("focuses and associates a password error returned by the account service", async () => {
		const user = userEvent.setup();
		authMocks.signInEmail.mockResolvedValue({
			error: { code: "PASSWORD_TOO_SHORT" },
		});

		render(<AuthForm />);
		await fillCredentials(user);
		await user.click(
			screen.getAllByRole("button", { name: "Sign in" }).at(-1)!,
		);

		const password = screen.getByLabelText("Password");
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(
			"Your password must be at least 10 characters.",
		);
		expect(password).toHaveAttribute("aria-invalid", "true");
		expect(password).toHaveAccessibleDescription(
			"At least 10 characters. Your password must be at least 10 characters.",
		);
		await waitFor(() => expect(password).toHaveFocus());
	});

	it("creates an account through the sign-up boundary", async () => {
		const user = userEvent.setup();
		authMocks.signUpEmail.mockResolvedValue({ error: null });

		render(<AuthForm />);
		await user.click(screen.getByRole("button", { name: "Create account" }));
		expect(
			screen.getByRole("heading", { name: "Create your account" }),
		).toBeVisible();

		await user.type(screen.getByRole("textbox", { name: "Name" }), "Pat Lee");
		await fillCredentials(user, "a secure password");
		await user.click(
			screen.getAllByRole("button", { name: "Create account" }).at(-1)!,
		);

		await waitFor(() =>
			expect(authMocks.signUpEmail).toHaveBeenCalledWith({
				email: "person@example.com",
				name: "Pat Lee",
				password: "a secure password",
			}),
		);
		expect(authMocks.signInEmail).not.toHaveBeenCalled();
		expect(authMocks.replace).toHaveBeenCalledWith("/account");
		expect(authMocks.refresh).toHaveBeenCalledOnce();
	});

	it("maps duplicate-account errors and clears them when switching modes", async () => {
		const user = userEvent.setup();
		authMocks.signUpEmail.mockResolvedValue({
			error: { code: "USER_ALREADY_EXISTS" },
		});

		render(<AuthForm />);
		await user.click(screen.getByRole("button", { name: "Create account" }));
		await user.type(screen.getByRole("textbox", { name: "Name" }), "Pat Lee");
		await fillCredentials(user);
		await user.click(
			screen.getAllByRole("button", { name: "Create account" }).at(-1)!,
		);

		expect(
			await screen.findByText(
				"An account already exists for that email. Try signing in instead.",
			),
		).toBeVisible();
		const email = screen.getByRole("textbox", { name: "Email address" });
		expect(email).toHaveAttribute("aria-invalid", "true");
		await waitFor(() => expect(email).toHaveFocus());

		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(
			screen.queryByText(
				"An account already exists for that email. Try signing in instead.",
			),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("textbox", { name: "Name" }),
		).not.toBeInTheDocument();
	});

	it("reports a network failure without attempting navigation", async () => {
		const user = userEvent.setup();
		authMocks.signInEmail.mockRejectedValue(new Error("offline"));

		render(<AuthForm />);
		await fillCredentials(user);
		await user.click(
			screen.getAllByRole("button", { name: "Sign in" }).at(-1)!,
		);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"We could not reach the account service. Check your connection and try again.",
		);
		await waitFor(() =>
			expect(
				screen.getByRole("textbox", { name: "Email address" }),
			).toHaveFocus(),
		);
		const email = screen.getByRole("textbox", { name: "Email address" });
		expect(email).toHaveAccessibleDescription(
			"We could not reach the account service. Check your connection and try again.",
		);
		expect(email).not.toHaveAttribute("aria-invalid");
		expect(authMocks.replace).not.toHaveBeenCalled();
		expect(authMocks.refresh).not.toHaveBeenCalled();
	});
});
