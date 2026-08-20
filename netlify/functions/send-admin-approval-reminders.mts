import type { Config } from "@netlify/functions";
import { sendPendingEventApprovalDigest } from "../../lib/admin-approval-digest";

async function sendApprovalReminders() {
	const result = await sendPendingEventApprovalDigest();

	switch (result.status) {
		case "no-pending":
			console.info("Approval reminder skipped: no pending events.");
			break;
		case "no-approvers":
			console.info(
				`Approval reminder skipped: no eligible approvers for ${result.pendingCount} pending events.`,
			);
			break;
		case "sent":
			console.info(
				`Approval reminder sent to ${result.recipientCount} approvers for ${result.pendingCount} pending events.`,
			);
			break;
	}
}

export default sendApprovalReminders;

export const config: Config = {
	// Netlify evaluates cron in UTC: 7 AM PST and 8 AM PDT.
	schedule: "0 15 * * *",
};
