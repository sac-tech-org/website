import preview from "@/.storybook/preview";
import { EventDescriptionEditor } from "@/app/events/submit/event-description-editor";
import { fn } from "storybook/test";

const formattedDescription = `## What to expect

Bring a laptop and meet other Sacramento developers.

- Short project demos
- Friendly code review
- Time to meet collaborators

> First-time attendees are especially welcome.

Read the [community guidelines](/code-of-conduct) before joining.

\`\`\`ts
const greeting = "Hello, Sacramento!";
\`\`\``;

const meta = preview.meta({
	title: "Components/Event Description Editor",
	component: EventDescriptionEditor,
	parameters: {
		layout: "padded",
	},
	args: {
		"aria-describedby": "description-help",
		disabled: false,
		onChange: fn(),
		value: "",
	},
	decorators: [
		(Story) => (
			<div style={{ margin: "0 auto", maxWidth: "48rem" }}>
				<label id="description-label" htmlFor="description">
					Description
				</label>
				<p id="description-help">
					Tell people what will happen and who the event is for.
				</p>
				<Story />
			</div>
		),
	],
});

export const Empty = meta.story({});

export const Formatted = Empty.extend({
	args: {
		value: formattedDescription,
	},
});

export const Invalid = Formatted.extend({
	args: {
		"aria-invalid": true,
	},
});

export const Disabled = Formatted.extend({
	args: {
		disabled: true,
	},
});

export const OverCharacterLimit = Empty.extend({
	args: {
		value: "A".repeat(4_025),
	},
});

export const BoldText = Empty.extend({
	play: async ({ canvas, userEvent }) => {
		const editor = canvas.getByRole("textbox", { name: "Description" });
		await userEvent.click(editor);
		await userEvent.click(canvas.getByRole("button", { name: "Bold" }));
		await userEvent.type(editor, "A hands-on community workshop");
	},
});
