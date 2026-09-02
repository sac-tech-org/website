import preview from "@/.storybook/preview";
import { EventHeader } from "@/app/events/[eventId]/event-header";
import { expect } from "storybook/test";

const meta = preview.meta({
	component: EventHeader,
	title: "Pages/Events/Event Header",
	parameters: {
		layout: "fullscreen",
	},
	args: {
		inPerson: true,
		isOnline: false,
		isRecurring: false,
		recurrenceRule: null,
		title: "Sacramento Design Summit",
	},
});

export const WithoutImage = meta.story({
	play: async ({ canvas, canvasElement }) => {
		await expect(
			canvas.getByRole("heading", {
				level: 1,
				name: "Sacramento Design Summit",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: "Back to all events" }),
		).toHaveAttribute("href", "/events");
		await expect(canvas.getByText("In person")).toBeVisible();
		await expect(canvasElement.querySelector("img")).not.toBeInTheDocument();
	},
});

export const WithImage = WithoutImage.extend({
	args: {
		imageUrl: "/images/opengraph/sactech-sticker.png",
	},
	play: async ({ canvasElement }) => {
		const image = canvasElement.querySelector("img");

		await expect(image).toHaveAttribute("alt", "");
		await expect(image).toHaveAttribute(
			"src",
			"/images/opengraph/sactech-sticker.png",
		);
	},
});
