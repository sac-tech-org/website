import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { initialCancellationFormState } from "@/lib/events/state";
import { CancelEventForm } from "./cancel-event-form";

const { cancelEventMock } = vi.hoisted(() => ({
	cancelEventMock: vi.fn(),
}));

vi.mock("@/lib/events/actions", () => ({
	cancelEvent: cancelEventMock,
}));

const recurringProps = {
	defaultOccurrenceDate: "2026-09-09",
	eventId: "10000000-0000-4000-8000-000000000001",
	eventTitle: "Sacramento TypeScript Meetup",
	isRecurring: true,
	maxOccurrenceDate: "2026-12-30",
	minOccurrenceDate: "2026-09-01",
} as const;

function submittedFields(callIndex = 0) {
	const [eventId, previousState, formData] = cancelEventMock.mock.calls[callIndex] as [
		string,
		typeof initialCancellationFormState,
		FormData,
	];

	return {
		eventId,
		fields: Object.fromEntries(formData.entries()),
		previousState,
	};
}

describe("CancelEventForm", () => {
	beforeEach(() => {
		cancelEventMock.mockReset();
	});

	it("submits a confirmed one-off cancellation with the selected occurrence", async () => {
		const user = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
		cancelEventMock.mockResolvedValue({
			message: "Occurrence canceled. The rest of the series is unchanged.",
			status: "success",
		});

		render(<CancelEventForm {...recurringProps} />);

		const dateInput = screen.getByLabelText(
			"Occurrence date",
		) as HTMLInputElement;
		expect(dateInput).toHaveValue("2026-09-09");
		expect(dateInput).toHaveAttribute("min", "2026-09-01");
		expect(dateInput).toHaveAttribute("max", "2026-12-30");

		await user.clear(dateInput);
		await user.type(dateInput, "2026-09-16");
		await user.click(
			screen.getByRole("button", { name: "Cancel this occurrence" }),
		);

		expect(confirm).toHaveBeenCalledWith(
			"Cancel the September 16, 2026 occurrence of “Sacramento TypeScript Meetup”? The rest of the series will remain scheduled.",
		);
		await waitFor(() => expect(cancelEventMock).toHaveBeenCalledTimes(1));
		expect(submittedFields()).toEqual({
			eventId: recurringProps.eventId,
			fields: {
				occurrenceDate: "2026-09-16",
				scope: "occurrence",
			},
			previousState: initialCancellationFormState,
		});
		expect(
			await screen.findByText(
				"Occurrence canceled. The rest of the series is unchanged.",
			),
		).toHaveAttribute("role", "status");
	});

	it("does not cross the server boundary when one-off confirmation is declined", async () => {
		const user = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

		render(<CancelEventForm {...recurringProps} />);
		await user.click(
			screen.getByRole("button", { name: "Cancel this occurrence" }),
		);

		expect(confirm).toHaveBeenCalledOnce();
		expect(cancelEventMock).not.toHaveBeenCalled();
	});

	it("keeps the selected occurrence visible when the server rejects cancellation", async () => {
		const user = userEvent.setup();
		vi.spyOn(window, "confirm").mockReturnValue(true);
		cancelEventMock.mockResolvedValue({
			message: "That event occurrence is already canceled.",
			status: "error",
		});

		render(<CancelEventForm {...recurringProps} />);
		const dateInput = screen.getByLabelText("Occurrence date");
		await user.clear(dateInput);
		await user.type(dateInput, "2026-09-16");
		await user.click(
			screen.getByRole("button", { name: "Cancel this occurrence" }),
		);

		expect(
			await screen.findByRole("alert"),
		).toHaveTextContent("That event occurrence is already canceled.");
		expect(dateInput).toHaveValue("2026-09-16");
	});

	it("uses a distinct confirmed action for canceling the entire series", async () => {
		const user = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
		cancelEventMock.mockResolvedValue({
			message: "Event canceled. It has been removed from the calendar.",
			status: "success",
		});

		render(<CancelEventForm {...recurringProps} />);
		await user.click(
			screen.getByRole("button", { name: "Cancel entire series" }),
		);

		expect(confirm).toHaveBeenCalledWith(
			"Cancel “Sacramento TypeScript Meetup”? This removes the entire series from the calendar, including every future occurrence.",
		);
		await waitFor(() => expect(cancelEventMock).toHaveBeenCalledTimes(1));
		expect(submittedFields()).toEqual({
			eventId: recurringProps.eventId,
			fields: { scope: "event" },
			previousState: initialCancellationFormState,
		});
		expect(screen.getByText("Event canceled. It has been removed from the calendar.")).toBeVisible();
	});

	it("only offers whole-event cancellation for a non-repeating event", async () => {
		const user = userEvent.setup();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

		render(
			<CancelEventForm
				{...recurringProps}
				defaultOccurrenceDate={null}
				isRecurring={false}
				maxOccurrenceDate={null}
			/>,
		);

		expect(
			screen.queryByLabelText("Occurrence date"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Cancel this occurrence" }),
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Cancel event" }));
		expect(confirm).toHaveBeenCalledWith(
			"Cancel “Sacramento TypeScript Meetup”? This removes the event from the calendar.",
		);
		expect(cancelEventMock).not.toHaveBeenCalled();
	});

	it("keeps series cancellation available when no future occurrence remains", () => {
		render(
			<CancelEventForm {...recurringProps} defaultOccurrenceDate={null} />,
		);

		expect(
			screen.getByText(
				"This series has no upcoming occurrences available to cancel.",
			),
		).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Cancel entire series" }),
		).toBeEnabled();
	});
});
