import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { EventFormState } from "@/lib/events/state";
import { EventForm } from "./event-form";

const serverActions = vi.hoisted(() => ({
	submitEvent: vi.fn(),
}));

vi.mock("@/lib/events/actions", () => ({
	submitEvent: serverActions.submitEvent,
}));

const TITLE = "SacTech Community Demo Night";
const DESCRIPTION =
	"See project demos from Sacramento developers and meet their creators.";
const STARTS_AT = "2099-05-19T10:00";
const ENDS_AT = "2099-05-19T12:00";

const successState: EventFormState = {
	message: "Event submitted for review.",
	status: "success",
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve;
	});

	return { promise, resolve };
}

function getSubmittedFormData(callIndex = 0) {
	const formData = serverActions.submitEvent.mock.calls[callIndex]?.[1];

	if (!(formData instanceof FormData)) {
		throw new TypeError("submitEvent did not receive FormData.");
	}

	return Array.from(formData.entries());
}

function getDescriptionEditor() {
	return screen.getByRole("textbox", { name: /Description/ });
}

function eventEntries(recurrenceEntries: Array<[string, string]> = []) {
	return [
		["title", TITLE],
		["description", DESCRIPTION],
		["startsAt", STARTS_AT],
		["endsAt", ENDS_AT],
		...recurrenceEntries,
		["mode", "in_person"],
		["locationName", "Central Library"],
		["locationAddress", "828 I Street, Sacramento, CA"],
		["eventUrl", ""],
	];
}

async function fillRequiredEventFields(
	user: ReturnType<typeof userEvent.setup>,
) {
	await user.type(screen.getByLabelText(/Event title/), TITLE);
	await user.type(getDescriptionEditor(), DESCRIPTION);
	await user.fill(screen.getByLabelText(/Starts/), STARTS_AT);
	await user.fill(screen.getByLabelText(/Ends/), ENDS_AT);
	await user.type(
		screen.getByLabelText("Venue or location name"),
		"Central Library",
	);
	await user.type(
		screen.getByLabelText("Street address"),
		"828 I Street, Sacramento, CA",
	);
}

function getControlLabel(control: HTMLElement) {
	const label = control.closest("label");

	if (!label) {
		throw new Error("Expected the form control to be wrapped in a label.");
	}

	return label;
}

async function enableRecurrence(user: ReturnType<typeof userEvent.setup>) {
	await user.click(
		screen.getByRole("checkbox", { name: /This event repeats/ }),
	);
}

async function submitAndWaitForSuccess(
	user: ReturnType<typeof userEvent.setup>,
) {
	await user.click(
		screen.getByRole("button", { name: "Submit event for review" }),
	);
	await screen.findByRole("status");
}

describe("EventForm", () => {
	beforeEach(() => {
		serverActions.submitEvent.mockResolvedValue(successState);
	});

	it("submits a one-time event with only the visible event fields", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		await fillRequiredEventFields(user);

		expect(screen.getByText(/Use Pacific time/)).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: /This event repeats/ }),
		).not.toBeChecked();

		await submitAndWaitForSuccess(user);

		expect(serverActions.submitEvent).toHaveBeenCalledTimes(1);
		expect(getSubmittedFormData()).toEqual(eventEntries());
	});

	it("serializes rich-text formatting as Markdown", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		await user.type(screen.getByLabelText(/Event title/), TITLE);

		const description = getDescriptionEditor();
		await user.click(description);
		await user.click(screen.getByRole("button", { name: "Bold" }));
		await user.keyboard(DESCRIPTION);
		await user.fill(screen.getByLabelText(/Starts/), STARTS_AT);
		await user.fill(screen.getByLabelText(/Ends/), ENDS_AT);
		await user.type(
			screen.getByLabelText("Venue or location name"),
			"Central Library",
		);
		await user.type(
			screen.getByLabelText("Street address"),
			"828 I Street, Sacramento, CA",
		);

		expect(description.querySelector("strong")).toHaveTextContent(DESCRIPTION);

		await submitAndWaitForSuccess(user);

		expect(getSubmittedFormData()).toEqual(
			eventEntries().map(([field, value]) =>
				field === "description"
					? [field, `**${DESCRIPTION}**`]
					: [field, value],
			),
		);
	});

	it("keeps focus in the title while the description has Markdown content", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		// Vitest's keyboard syntax uses `[[` to enter a literal opening bracket.
		await user.type(getDescriptionEditor(), "[[SacTech](https://sac-tech.org)");
		expect(screen.getByRole("link", { name: "SacTech" })).toBeInTheDocument();

		const title = screen.getByLabelText(/Event title/);
		await user.type(title, "S");

		expect(title).toHaveValue("S");
		expect(title).toHaveFocus();
		await user.keyboard("a");
		expect(title).toHaveValue("Sa");
	});

	it("submits a daily series that never ends", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		await fillRequiredEventFields(user);
		await enableRecurrence(user);
		await user.selectOptions(screen.getByLabelText("Recurrence unit"), "day");

		expect(
			screen.getByText(
				"The event starts at the same Pacific time each time it repeats.",
			),
		).toBeVisible();
		expect(screen.queryByRole("group", { name: /Repeat on/ })).toBeNull();

		await submitAndWaitForSuccess(user);

		expect(getSubmittedFormData()).toEqual(
			eventEntries([
				["recurring", "on"],
				["recurrenceInterval", "1"],
				["recurrenceFrequency", "day"],
				["recurrenceEndType", "never"],
			]),
		);
	});

	it("keeps the start weekday selected and submits added weekly days through an end date", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		await fillRequiredEventFields(user);
		await enableRecurrence(user);

		const weekdayGroup = screen.getByRole("group", { name: /Repeat on/ });
		const tuesday = screen.getByRole("checkbox", { name: "Tuesday" });
		const thursday = screen.getByRole("checkbox", { name: "Thursday" });
		expect(weekdayGroup).toBeVisible();
		expect(tuesday).toBeChecked();

		await user.click(getControlLabel(tuesday));
		expect(tuesday).toBeChecked();
		await user.click(getControlLabel(thursday));
		expect(thursday).toBeChecked();
		await user.click(screen.getByRole("radio", { name: "On date" }));
		await user.fill(screen.getByLabelText("Recurrence end date"), "2099-08-19");

		await submitAndWaitForSuccess(user);

		expect(getSubmittedFormData()).toEqual(
			eventEntries([
				["recurring", "on"],
				["recurrenceInterval", "1"],
				["recurrenceFrequency", "week"],
				["recurrenceWeekdays", "2"],
				["recurrenceWeekdays", "4"],
				["recurrenceEndType", "on_date"],
				["recurrenceEndDate", "2099-08-19"],
			]),
		);
	});

	it("submits a monthly ordinal-weekday series after a chosen occurrence count", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		await fillRequiredEventFields(user);
		await enableRecurrence(user);
		await user.selectOptions(screen.getByLabelText("Recurrence unit"), "month");

		const monthlyPattern = screen.getByLabelText("Monthly pattern");
		expect(monthlyPattern).toHaveDisplayValue("Day 19 of the month");
		expect(
			screen.getByRole("option", {
				name: "The 3rd Tuesday of the month",
			}),
		).toBeInTheDocument();
		await user.selectOptions(monthlyPattern, "nth_weekday");
		await user.click(screen.getByRole("radio", { name: "After" }));
		const occurrenceCount = screen.getByLabelText("Number of occurrences");
		await user.clear(occurrenceCount);
		await user.type(occurrenceCount, "12");

		await submitAndWaitForSuccess(user);

		expect(getSubmittedFormData()).toEqual(
			eventEntries([
				["recurring", "on"],
				["recurrenceInterval", "1"],
				["recurrenceFrequency", "month"],
				["recurrenceMonthlyPattern", "nth_weekday"],
				["recurrenceEndType", "after_occurrences"],
				["recurrenceCount", "12"],
			]),
		);
	});

	it("submits a yearly series and explains the start date that will repeat", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		await fillRequiredEventFields(user);
		await enableRecurrence(user);
		await user.selectOptions(screen.getByLabelText("Recurrence unit"), "year");
		const interval = screen.getByLabelText("Repeat every");
		await user.clear(interval);
		await user.type(interval, "2");

		const yearlyDate = screen.getByText("May 19");
		expect(yearlyDate.closest("p")).toHaveTextContent(
			"The event repeats every 2 years on May 19 at the same Pacific time.",
		);

		await submitAndWaitForSuccess(user);

		expect(getSubmittedFormData()).toEqual(
			eventEntries([
				["recurring", "on"],
				["recurrenceInterval", "2"],
				["recurrenceFrequency", "year"],
				["recurrenceEndType", "never"],
			]),
		);
	});

	it("preserves entered values and recurrence controls when the server returns errors", async () => {
		const user = userEvent.setup();
		serverActions.submitEvent.mockResolvedValue({
			errors: {
				eventUrl: ["That registration link is unavailable."],
				title: ["That title is already in use."],
			},
			message: "Check the highlighted fields and try again.",
			status: "error",
		} satisfies EventFormState);
		render(<EventForm />);
		await fillRequiredEventFields(user);
		await enableRecurrence(user);
		await user.selectOptions(screen.getByLabelText("Recurrence unit"), "month");
		const recurrenceInterval = screen.getByLabelText("Repeat every");
		await user.clear(recurrenceInterval);
		await user.type(recurrenceInterval, "3");
		await user.selectOptions(
			screen.getByLabelText("Monthly pattern"),
			"nth_weekday",
		);
		await user.click(screen.getByRole("radio", { name: "After" }));
		const count = screen.getByLabelText("Number of occurrences");
		await user.clear(count);
		await user.type(count, "8");
		await user.click(
			getControlLabel(screen.getByRole("radio", { name: /^Hybrid/ })),
		);
		await user.type(
			screen.getByLabelText("Event or registration link"),
			"https://example.com/demo-night",
		);

		await user.click(
			screen.getByRole("button", { name: "Submit event for review" }),
		);

		const alert = await screen.findByRole("alert");
		const title = screen.getByLabelText(/Event title/);
		expect(alert).toHaveTextContent(
			"Check the highlighted fields and try again.",
		);
		expect(screen.getByText("That title is already in use.")).toBeVisible();
		expect(title).toHaveValue(TITLE);
		expect(getDescriptionEditor()).toHaveTextContent(DESCRIPTION);
		expect(screen.getByLabelText(/Starts/)).toHaveValue(STARTS_AT);
		expect(screen.getByLabelText(/Ends/)).toHaveValue(ENDS_AT);
		expect(screen.getByLabelText("Venue or location name")).toHaveValue(
			"Central Library",
		);
		expect(screen.getByLabelText("Street address")).toHaveValue(
			"828 I Street, Sacramento, CA",
		);
		expect(screen.getByLabelText("Event or registration link")).toHaveValue(
			"https://example.com/demo-night",
		);
		await waitFor(() =>
			expect(screen.getByRole("radio", { name: /^Hybrid/ })).toBeChecked(),
		);
		expect(
			screen.getByRole("checkbox", { name: /This event repeats/ }),
		).toBeChecked();
		expect(screen.getByLabelText("Recurrence unit")).toHaveValue("month");
		expect(screen.getByLabelText("Repeat every")).toHaveValue(3);
		expect(screen.getByLabelText("Monthly pattern")).toHaveValue("nth_weekday");
		expect(screen.getByRole("radio", { name: "After" })).toBeChecked();
		expect(screen.getByLabelText("Number of occurrences")).toHaveValue(8);
		expect(title).toHaveAttribute("aria-invalid", "true");
		expect(title).toHaveAccessibleDescription(
			"Use the event name attendees will see. That title is already in use.",
		);
		await waitFor(() => expect(title).toHaveFocus());

		await user.type(title, " updated");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(
			screen.queryByText("That title is already in use."),
		).not.toBeInTheDocument();
		expect(title).not.toHaveAttribute("aria-invalid");
	});

	it("focuses the editor and clears feedback for a description error", async () => {
		const user = userEvent.setup();
		serverActions.submitEvent.mockResolvedValue({
			errors: {
				description: ["Add a little more detail for attendees."],
			},
			message: "Check the highlighted fields and try again.",
			status: "error",
		} satisfies EventFormState);
		render(<EventForm />);
		await fillRequiredEventFields(user);

		await user.click(
			screen.getByRole("button", { name: "Submit event for review" }),
		);

		const description = getDescriptionEditor();
		expect(await screen.findByRole("alert")).toBeVisible();
		expect(description).toHaveAttribute("aria-invalid", "true");
		expect(description).toHaveAccessibleDescription(
			"Tell people what will happen, who the event is for, and what they should bring or know. Add a little more detail for attendees.",
		);
		await waitFor(() => expect(description).toHaveFocus());

		await user.keyboard(" More details.");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(description).not.toHaveAttribute("aria-invalid");
	});

	it("removes stale validation feedback while a retry is pending", async () => {
		const user = userEvent.setup();
		serverActions.submitEvent.mockResolvedValueOnce({
			errors: {
				title: ["That title is already in use."],
			},
			message: "Check the highlighted fields and try again.",
			status: "error",
		} satisfies EventFormState);
		render(<EventForm />);
		await fillRequiredEventFields(user);

		await user.click(
			screen.getByRole("button", { name: "Submit event for review" }),
		);
		await screen.findByRole("alert");

		const retryResult = deferred<EventFormState>();
		serverActions.submitEvent.mockReturnValueOnce(retryResult.promise);
		await user.click(
			screen.getByRole("button", { name: "Submit event for review" }),
		);

		const form = screen.getByLabelText(/Event title/).closest("form");
		await waitFor(() => expect(form).toHaveAttribute("aria-busy", "true"));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(
			screen.queryByText("That title is already in use."),
		).not.toBeInTheDocument();

		await act(async () => {
			retryResult.resolve(successState);
			await retryResult.promise;
		});
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Event submitted for review.",
		);
	});

	it("locks the submitted draft while the server action is pending", async () => {
		const user = userEvent.setup();
		const result = deferred<EventFormState>();
		serverActions.submitEvent.mockReturnValue(result.promise);
		render(<EventForm />);
		await fillRequiredEventFields(user);
		await enableRecurrence(user);

		await user.click(
			screen.getByRole("button", { name: "Submit event for review" }),
		);

		const title = screen.getByLabelText(/Event title/);
		const form = title.closest("form");
		expect(form).not.toBeNull();
		expect(form).toHaveAttribute("aria-busy", "true");
		expect(title).toBeDisabled();
		expect(getDescriptionEditor()).toHaveAttribute("aria-disabled", "true");
		expect(getDescriptionEditor()).toHaveAttribute("contenteditable", "false");
		expect(screen.getByLabelText(/Starts/)).toBeDisabled();
		expect(screen.getByLabelText("Recurrence unit")).toBeDisabled();
		expect(screen.getByRole("radio", { name: /^In person/ })).toBeDisabled();
		expect(screen.getByLabelText("Event or registration link")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();

		await act(async () => {
			result.resolve(successState);
			await result.promise;
		});

		expect(await screen.findByRole("status")).toHaveTextContent(
			"Event submitted for review.",
		);
		expect(form).toHaveAttribute("aria-busy", "false");
	});

	it("resets event and recurrence fields only after a successful submission", async () => {
		const user = userEvent.setup();
		render(<EventForm />);
		await fillRequiredEventFields(user);
		await enableRecurrence(user);
		await user.selectOptions(screen.getByLabelText("Recurrence unit"), "day");
		await user.click(
			getControlLabel(screen.getByRole("radio", { name: /^Hybrid/ })),
		);
		await user.type(
			screen.getByLabelText("Event or registration link"),
			"https://example.com/demo-night",
		);

		await submitAndWaitForSuccess(user);

		await waitFor(() => {
			expect(screen.getByLabelText(/Event title/)).toHaveValue("");
			expect(getDescriptionEditor()).toHaveTextContent("");
			expect(screen.getByLabelText(/Starts/)).toHaveValue("");
			expect(screen.getByLabelText(/Ends/)).toHaveValue("");
			expect(screen.getByLabelText("Venue or location name")).toHaveValue("");
			expect(screen.getByLabelText("Street address")).toHaveValue("");
			expect(screen.getByLabelText("Event or registration link")).toHaveValue(
				"",
			);
			expect(
				screen.getByRole("checkbox", { name: /This event repeats/ }),
			).not.toBeChecked();
		});
		expect(screen.queryByLabelText("Recurrence unit")).toBeNull();
		expect(screen.getByRole("radio", { name: /^In person/ })).toBeChecked();
		expect(screen.getByRole("status")).toHaveTextContent(
			"Event submitted for review.",
		);

		await user.type(screen.getByLabelText(/Event title/), "Another meetup");
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
