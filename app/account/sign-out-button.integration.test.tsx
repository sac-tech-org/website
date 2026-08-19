import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { SignOutButton } from "./sign-out-button";

const signOutMocks = vi.hoisted(() => ({
	refresh: vi.fn(),
	replace: vi.fn(),
	signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: signOutMocks.refresh,
		replace: signOutMocks.replace,
	}),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: { signOut: signOutMocks.signOut },
}));

describe("SignOutButton", () => {
	beforeEach(() => {
		for (const mock of Object.values(signOutMocks)) {
			mock.mockReset();
		}
	});

	it("signs out and returns to the local auth route", async () => {
		const user = userEvent.setup();
		signOutMocks.signOut.mockResolvedValue({ error: null });

		render(<SignOutButton />);
		await user.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => expect(signOutMocks.signOut).toHaveBeenCalledWith());
		expect(signOutMocks.replace).toHaveBeenCalledWith("/auth");
		expect(signOutMocks.refresh).toHaveBeenCalledOnce();
	});

	it("surfaces an account-service error and stays on the account page", async () => {
		const user = userEvent.setup();
		signOutMocks.signOut.mockResolvedValue({
			error: { message: "The session could not be revoked." },
		});

		render(<SignOutButton />);
		await user.click(screen.getByRole("button", { name: "Sign out" }));

		expect(
			await screen.findByText("The session could not be revoked."),
		).toBeVisible();
		expect(signOutMocks.replace).not.toHaveBeenCalled();
		expect(signOutMocks.refresh).not.toHaveBeenCalled();
	});

	it("recovers the button after a network failure", async () => {
		const user = userEvent.setup();
		signOutMocks.signOut.mockRejectedValue(new Error("offline"));

		render(<SignOutButton />);
		await user.click(screen.getByRole("button", { name: "Sign out" }));

		expect(
			await screen.findByText(
				"We couldn't connect to the account service. Check your connection and try again.",
			),
		).toBeVisible();
		expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
		expect(signOutMocks.replace).not.toHaveBeenCalled();
	});
});
