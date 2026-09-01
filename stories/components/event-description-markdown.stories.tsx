import preview from "@/.storybook/preview";
import { EventDescriptionMarkdown } from "@/components/event-description-markdown";
import { expect } from "storybook/test";

const richMarkdown = [
	"# What to expect",
	"",
	"Meet **Sacramento builders** and share what you are learning.",
	"",
	"> Bring a project, a question, or just your curiosity.",
	"",
	"- See community demos",
	"- Meet a collaborator",
	"- Try `pnpm test` with a neighbor",
	"",
	"```ts",
	'const greeting = "Hello, Sacramento!";',
	"```",
	"",
	"[Event details](https://events.example.com/sac-tech)",
].join("\n");

const meta = preview.meta({
	title: "Components/Event Description Markdown",
	component: EventDescriptionMarkdown,
	parameters: {
		layout: "centered",
	},
	tags: ["autodocs"],
	decorators: [
		(Story) => (
			<div
				style={{
					background: "var(--color-paper)",
					border: "1px solid var(--color-line)",
					padding: "1.5rem",
					width: "min(42rem, calc(100vw - 2rem))",
				}}
			>
				<Story />
			</div>
		),
	],
});

export const RichContent = meta.story({
	args: {
		markdown: richMarkdown,
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("heading", { level: 4, name: "What to expect" }),
		).toBeVisible();
		await expect(canvas.getByText("Sacramento builders").tagName).toBe(
			"STRONG",
		);
		await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
		await expect(
			canvas.getByRole("link", { name: "Event details" }),
		).toHaveAttribute("target", "_blank");
	},
});

export const TruncatedContent = meta.story({
	args: {
		markdown: `${"A".repeat(295)} **bold ending remains valid**\n\n[Hidden link](https://example.com)`,
		maxCharacters: 300,
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("bold…").tagName).toBe("STRONG");
		await expect(
			canvas.queryByRole("link", { name: "Hidden link" }),
		).not.toBeInTheDocument();
	},
});

export const UnsafeInput = meta.story({
	args: {
		markdown: [
			"Safe introduction.",
			"",
			"<script>window.__eventMarkdownRan = true</script>",
			'<img src="missing" onerror="window.__eventMarkdownRan = true">',
			"",
			"[Unsafe destination](javascript:alert('nope'))",
		].join("\n"),
	},
	play: async ({ canvas, canvasElement }) => {
		await expect(canvas.getByText("Safe introduction.")).toBeVisible();
		await expect(canvasElement.querySelector("script")).not.toBeInTheDocument();
		await expect(canvasElement.querySelector("img")).not.toBeInTheDocument();
		await expect(
			canvas.getByText("Unsafe destination").closest("a"),
		).not.toHaveAttribute("href");
	},
});
