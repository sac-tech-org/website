import preview from "@/.storybook/preview";
import { HomePage } from "@/app/page";

const meta = preview.meta({
	component: HomePage,
	title: "Pages/Home",
	parameters: {
		layout: "fullscreen",
	},
});

export const SlackInviteAvailable = meta.story({
	args: {
		inviteLink: "https://join.slack.com/t/sactech/shared_invite/storybook",
	},
});

export const SlackInviteUnavailable = SlackInviteAvailable.extend({
	args: {
		inviteLink: undefined,
	},
});
