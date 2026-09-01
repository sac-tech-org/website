import preview from "@/.storybook/preview";
import SubmitEventPage from "@/app/events/submit/page";
import { requireSession } from "@/lib/session";
import { createSession } from "@/stories/fixtures/auth";
import { mocked } from "storybook/test";

const meta = preview.meta({
	component: SubmitEventPage,
	title: "Pages/Events/Submit",
	parameters: {
		layout: "fullscreen",
	},
});

export const Authenticated = meta.story({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
	},
});

export const CheckingSession = Authenticated.extend({
	beforeEach: () => {
		mocked(requireSession).mockImplementation(() => new Promise(() => {}));
	},
});
