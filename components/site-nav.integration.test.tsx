// @vitest-environment jsdom

import { within } from "@testing-library/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteNav } from "./site-nav";

vi.mock("next/navigation", () => ({
	usePathname: () => "/events",
}));

describe("SiteNav", () => {
	it("keeps event submission contextual to the events page", () => {
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
});
