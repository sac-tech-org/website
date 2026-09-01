import preview from "@/.storybook/preview";
import AdminEventsPage from "@/app/admin/events/page";
import { getPendingEventEdits, getPendingEvents } from "@/lib/events/queries";
import { requireEventReviewerSession } from "@/lib/session";
import { createSession } from "@/stories/fixtures/auth";
import {
	PENDING_ADMIN_EVENT_EDITS,
	PENDING_ADMIN_EVENTS,
} from "@/stories/fixtures/admin";
import { expect, mocked } from "storybook/test";

const meta = preview.meta({
	title: "Pages/Admin/Review Events",
	component: AdminEventsPage,
	parameters: {
		layout: "fullscreen",
	},
});

function mockReviewerSession() {
	mocked(requireEventReviewerSession).mockResolvedValue(
		createSession({
			email: "reviewer@example.com",
			id: "storybook-reviewer",
			name: "Storybook Reviewer",
			role: "approver",
		}),
	);
}

export const LoadingQueues = meta.story({
	beforeEach: () => {
		mocked(requireEventReviewerSession).mockImplementation(
			() => new Promise(() => {}),
		);
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "Loading submitted events…",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Loading proposed changes…" }),
		).toBeVisible();
	},
});

export const EmptyQueues = meta.story({
	beforeEach: () => {
		mockReviewerSession();
		mocked(getPendingEvents).mockResolvedValue([]);
		mocked(getPendingEventEdits).mockResolvedValue([]);
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "Nothing to review right now.",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", {
				name: "No event changes are waiting.",
			}),
		).toBeVisible();
	},
});

export const PopulatedQueues = meta.story({
	beforeEach: () => {
		mockReviewerSession();
		mocked(getPendingEvents).mockResolvedValue(PENDING_ADMIN_EVENTS);
		mocked(getPendingEventEdits).mockResolvedValue(PENDING_ADMIN_EVENT_EDITS);
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole("heading", {
				name: "Sacramento Community Demo Night",
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Civic Tech Project Clinic" }),
		).toBeVisible();
		await expect(canvas.getByText("events waiting")).toHaveTextContent(
			"2 events waiting",
		);
		await expect(canvas.getByText("change waiting")).toHaveTextContent(
			"1 change waiting",
		);
	},
});
