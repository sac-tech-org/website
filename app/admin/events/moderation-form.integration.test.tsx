import { within } from "@testing-library/dom";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { ModerationFormState } from "@/lib/events/state";
import { ModerationForm } from "./moderation-form";

const serverActions = vi.hoisted(() => ({
	moderateEvent: vi.fn(),
}));

vi.mock("@/lib/events/actions", () => ({
	moderateEvent: serverActions.moderateEvent,
}));

const EVENT_ID = "4af57f4b-f482-4e8a-922b-0c965329ece4";

function getSubmittedFormData(callIndex = 0) {
	const formData = serverActions.moderateEvent.mock.calls[callIndex]?.[2];

	if (!(formData instanceof FormData)) {
		throw new TypeError("moderateEvent did not receive FormData.");
	}

	return Array.from(formData.entries());
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve;
	});

	return { promise, resolve };
}

describe("ModerationForm", () => {
	beforeEach(() => {
		serverActions.moderateEvent.mockResolvedValue({
			message: "Event approved and published.",
			status: "success",
		} satisfies ModerationFormState);
	});

	it("submits an approval with the bound event id and exposes pending and success states", async () => {
		const user = userEvent.setup();
		const result = deferred<ModerationFormState>();
		serverActions.moderateEvent.mockReturnValue(result.promise);
		render(<ModerationForm eventId={EVENT_ID} eventTitle="Demo Night" />);
		const form = screen.getByRole("form", { name: "Review Demo Night" });
		const formQueries = within(form);

		expect(
			formQueries.getByText("Approval publishes this event to the calendar."),
		).toBeVisible();
		await user.type(
			formQueries.getByLabelText("Note to submitter (optional)"),
			"Looks good for the community calendar.",
		);
		await user.click(
			formQueries.getByRole("button", { name: "Approve and publish" }),
		);

		expect(serverActions.moderateEvent).toHaveBeenCalledTimes(1);
		expect(serverActions.moderateEvent.mock.calls[0]?.[0]).toBe(EVENT_ID);
		expect(serverActions.moderateEvent.mock.calls[0]?.[1]).toEqual({
			message: "",
			status: "idle",
		});
		expect(getSubmittedFormData()).toEqual([
			["note", "Looks good for the community calendar."],
			["decision", "approved"],
		]);
		for (const button of formQueries.getAllByRole("button", {
			name: "Saving…",
		})) {
			expect(button).toBeDisabled();
		}
		expect(
			formQueries.getByLabelText("Note to submitter (optional)"),
		).toBeDisabled();

		await act(async () => {
			result.resolve({
				message: "Event approved and published.",
				status: "success",
			});
			await result.promise;
		});

		expect(await screen.findByRole("status")).toHaveTextContent(
			"Event approved and published.",
		);
		expect(
			formQueries.getByLabelText("Note to submitter (optional)"),
		).toHaveValue("");
	});

	it("submits a rejection and renders the error state returned by the server", async () => {
		const user = userEvent.setup();
		serverActions.moderateEvent.mockResolvedValue({
			message: "Add a short note so the submitter knows what to change.",
			status: "error",
		} satisfies ModerationFormState);
		render(<ModerationForm eventId={EVENT_ID} eventTitle="Demo Night" />);
		const note = screen.getByLabelText("Note to submitter (optional)");
		await user.type(note, "No");
		await user.click(screen.getByRole("button", { name: "Reject with note" }));

		expect(serverActions.moderateEvent).toHaveBeenCalledTimes(1);
		expect(serverActions.moderateEvent.mock.calls[0]?.[0]).toBe(EVENT_ID);
		expect(getSubmittedFormData()).toEqual([
			["note", "No"],
			["decision", "rejected"],
		]);
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(
			"Add a short note so the submitter knows what to change.",
		);
		expect(note).toHaveValue("No");
	});
});
