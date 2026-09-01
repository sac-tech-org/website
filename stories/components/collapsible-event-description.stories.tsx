import preview from "@/.storybook/preview";
import { CollapsibleEventDescription } from "@/components/collapsible-event-description";
import { expect } from "storybook/test";

const longMarkdown = `${"A".repeat(295)} **bold tail stays formatted**\n\n[Event details](https://events.example.com/details)`;

const meta = preview.meta({
	title: "Components/Collapsible Event Description",
	component: CollapsibleEventDescription,
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

export const ExactlyAtLimit = meta.story({
	args: {
		eventTitle: "A concise event",
		markdown: "A".repeat(300),
	},
	play: async ({ canvas }) => {
		await expect(canvas.getByText("A".repeat(300))).toBeVisible();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
});

export const LongDescription = meta.story({
	args: {
		eventTitle: "SacTech community night",
		markdown: longMarkdown,
	},
	play: async ({ canvas }) => {
		const toggle = canvas.getByRole("button", {
			name: "Show more details for SacTech community night",
		});

		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(canvas.getByText("bold…").tagName).toBe("STRONG");
		await expect(
			canvas.queryByRole("link", { name: "Event details" }),
		).not.toBeInTheDocument();
	},
});

export const Expanded = LongDescription.extend({
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Show more details for SacTech community night",
			}),
		);

		await expect(
			canvas.getByRole("button", {
				name: "Show less details for SacTech community night",
			}),
		).toHaveAttribute("aria-expanded", "true");
		await expect(canvas.getByText("bold tail stays formatted").tagName).toBe(
			"STRONG",
		);
		await expect(
			canvas.getByRole("link", { name: "Event details" }),
		).toBeVisible();
	},
});
