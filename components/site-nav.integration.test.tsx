import { within } from "@testing-library/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteNav } from "./site-nav";

const usePathname = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
	usePathname,
}));

describe("SiteNav", () => {
	it("keeps event submission contextual to the events page", () => {
		usePathname.mockReturnValue("/events");
		render(<SiteNav />);

		const navigation = within(
			screen.getByRole("navigation", { name: "Primary" }),
		);
		expect(navigation.getByRole("link", { name: "Events" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(
			navigation.queryByRole("link", { name: "Submit an event" }),
		).not.toBeInTheDocument();
	});

	it("keeps Events current on an event detail route", () => {
		usePathname.mockReturnValue("/events/00000000-0000-4000-8000-000000000001");
		render(<SiteNav />);

		const navigation = within(
			screen.getByRole("navigation", { name: "Primary" }),
		);
		expect(navigation.getByRole("link", { name: "Events" })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});
});
