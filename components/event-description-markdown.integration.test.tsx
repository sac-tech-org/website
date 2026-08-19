import { within } from "@testing-library/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventDescriptionMarkdown } from "./event-description-markdown";

describe("EventDescriptionMarkdown", () => {
	it("renders formatted event copy and protects external links", () => {
		const { container } = render(
			<EventDescriptionMarkdown
				markdown={[
					"#### What to expect",
					"",
					"Meet **Sacramento builders**.",
					"",
					"- Share a project",
					"- Meet a collaborator",
					"",
					"[Event details](https://events.example.com/sac-tech)",
				].join("\n")}
			/>,
		);

		expect(
			screen.getByRole("heading", { level: 4, name: "What to expect" }),
		).toBeVisible();
		expect(screen.getByText("Sacramento builders").tagName).toBe("STRONG");

		const list = screen.getByRole("list");
		expect(within(list).getAllByRole("listitem")).toHaveLength(2);
		expect(list).toHaveTextContent("Share a project");
		expect(list).toHaveTextContent("Meet a collaborator");

		const link = screen.getByRole("link", { name: "Event details" });
		expect(link).toHaveAttribute("href", "https://events.example.com/sac-tech");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
		expect(container.querySelector("img")).not.toBeInTheDocument();
	});

	it("drops raw HTML and removes unsafe link destinations", () => {
		const { container } = render(
			<EventDescriptionMarkdown
				markdown={[
					"Safe introduction.",
					"",
					"<script>window.__eventMarkdownRan = true</script>",
					'<img src="missing" onerror="window.__eventMarkdownRan = true">',
					"",
					"[Unsafe destination](javascript:alert('nope'))",
				].join("\n")}
			/>,
		);

		expect(screen.getByText("Safe introduction.")).toBeVisible();
		expect(container.querySelector("script")).not.toBeInTheDocument();
		expect(container.querySelector("img")).not.toBeInTheDocument();
		expect(container.innerHTML).not.toContain("javascript:");
		expect(
			screen.getByText("Unsafe destination").closest("a"),
		).not.toHaveAttribute("href");
	});

	it("truncates the parsed Markdown tree without breaking formatting", () => {
		const { container } = render(
			<EventDescriptionMarkdown
				markdown={`${"A".repeat(295)} **bold ending remains valid**\n\n[Hidden link](https://example.com)`}
				maxCharacters={300}
			/>,
		);

		expect(screen.getByText("bold…").tagName).toBe("STRONG");
		expect(screen.queryByText(/ending remains valid/)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Hidden link" }),
		).not.toBeInTheDocument();
		expect(container.textContent).toContain(`${"A".repeat(295)} bold…`);
	});
});
