import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import VerifyEmailPage from "./page";

const navigationMocks = vi.hoisted(() => ({
	redirect: vi.fn((destination: string) => {
		throw new Error(`NEXT_REDIRECT:${destination}`);
	}),
}));

vi.mock("next/navigation", () => ({
	redirect: navigationMocks.redirect,
}));

// next/link depends on Next's runtime router context, which this browser-level
// page test intentionally does not boot.
vi.mock("next/link", () => ({
	__esModule: true,
	default: ({ children, ...props }: ComponentProps<"a">) => (
		<a {...props}>{children}</a>
	),
}));

describe("VerifyEmailPage", () => {
	it("redirects a successful verification callback to the account", async () => {
		await VerifyEmailPage({ searchParams: Promise.resolve({}) }).catch(
			() => undefined,
		);
		expect(navigationMocks.redirect).toHaveBeenCalledWith("/account");
	});

	it.each([
		{
			error: "TOKEN_EXPIRED",
			heading: "Verification link expired",
			message: "This verification link has expired.",
		},
		{
			error: "INVALID_TOKEN",
			heading: "Verification link unavailable",
			message: "This verification link is invalid or has already been used.",
		},
		{
			error: "USER_NOT_FOUND",
			heading: "We couldn't verify your email",
			message: "This verification link can't be used.",
		},
	])(
		"shows a recovery path for $error",
		async ({ error, heading, message }) => {
			render(
				await VerifyEmailPage({
					searchParams: Promise.resolve({ error }),
				}),
			);

			expect(screen.getByRole("alert")).toHaveTextContent(message);
			expect(screen.getByRole("heading", { name: heading })).toBeVisible();
			expect(
				screen.getByRole("link", { name: /Back to sign in/ }),
			).toHaveAttribute("href", "/auth");
			expect(navigationMocks.redirect).not.toHaveBeenCalled();
		},
	);
});
