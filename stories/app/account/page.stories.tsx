import preview from "@/.storybook/preview";
import AccountPage from "@/app/account/page";
import { getSubmissionsForUser } from "@/lib/events/queries";
import { requireSession } from "@/lib/session";
import { createSession } from "@/stories/fixtures/auth";
import { mixedSubmissions } from "@/stories/fixtures/submissions";
import { mocked } from "storybook/test";

const meta = preview.meta({
	component: AccountPage,
	title: "Pages/Account",
	parameters: {
		layout: "fullscreen",
	},
});

export const NewSubmitter = meta.story({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(createSession());
		mocked(getSubmissionsForUser).mockResolvedValue([]);
	},
});

export const AdminWithManagedEvents = NewSubmitter.extend({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(
			createSession({
				name: "Morgan Lee",
				role: "admin",
			}),
		);
		mocked(getSubmissionsForUser).mockResolvedValue(mixedSubmissions);
	},
});

export const Approver = NewSubmitter.extend({
	beforeEach: () => {
		mocked(requireSession).mockResolvedValue(
			createSession({
				name: "Taylor Brooks",
				role: "approver",
			}),
		);
		mocked(getSubmissionsForUser).mockResolvedValue(
			mixedSubmissions.slice(0, 2),
		);
	},
});

export const Loading = NewSubmitter.extend({
	beforeEach: () => {
		mocked(requireSession).mockImplementation(() => new Promise(() => {}));
		mocked(getSubmissionsForUser).mockImplementation(
			() => new Promise(() => {}),
		);
	},
});
