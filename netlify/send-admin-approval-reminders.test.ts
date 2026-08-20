import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendPendingEventApprovalDigestMock } = vi.hoisted(() => ({
	sendPendingEventApprovalDigestMock: vi.fn(),
}));

vi.mock("../lib/admin-approval-digest", () => ({
	sendPendingEventApprovalDigest: sendPendingEventApprovalDigestMock,
}));

import handler, { config } from "./functions/send-admin-approval-reminders.mjs";

describe("send-admin-approval-reminders scheduled function", () => {
	beforeEach(() => {
		sendPendingEventApprovalDigestMock.mockReset();
	});

	it("uses the fixed 7 AM PST / 8 AM PDT UTC schedule", () => {
		expect(config).toEqual({ schedule: "0 15 * * *" });
	});

	it("runs the approval digest and logs only aggregate delivery data", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
		sendPendingEventApprovalDigestMock.mockResolvedValue({
			status: "sent",
			pendingCount: 4,
			recipientCount: 2,
		});

		await handler();

		expect(sendPendingEventApprovalDigestMock).toHaveBeenCalledOnce();
		expect(info).toHaveBeenCalledWith(
			"Admin approval digest sent to 2 admins for 4 pending events.",
		);
	});

	it("reports skip reasons without exposing recipient or event details", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
		sendPendingEventApprovalDigestMock
			.mockResolvedValueOnce({ status: "no-pending", pendingCount: 0 })
			.mockResolvedValueOnce({ status: "no-admins", pendingCount: 3 });

		await handler();
		await handler();

		expect(info).toHaveBeenNthCalledWith(
			1,
			"Admin approval digest skipped: no pending events.",
		);
		expect(info).toHaveBeenNthCalledWith(
			2,
			"Admin approval digest skipped: no eligible admins for 3 pending events.",
		);
	});

	it("lets delivery failures fail the scheduled invocation", async () => {
		sendPendingEventApprovalDigestMock.mockRejectedValue(
			new Error("delivery failed"),
		);

		await expect(handler()).rejects.toThrow("delivery failed");
	});
});
