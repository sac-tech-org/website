import type { Config } from "@netlify/functions";
import { sendPendingEventApprovalDigest } from "../../lib/admin-approval-digest";

async function sendAdminApprovalReminders() {
	const result = await sendPendingEventApprovalDigest();

	switch (result.status) {
		case "no-pending":
			console.info("Admin approval digest skipped: no pending events.");
			break;
		case "no-admins":
			console.info(
				`Admin approval digest skipped: no eligible admins for ${result.pendingCount} pending events.`,
			);
			break;
		case "sent":
			console.info(
				`Admin approval digest sent to ${result.recipientCount} admins for ${result.pendingCount} pending events.`,
			);
			break;
	}
}

export default sendAdminApprovalReminders;

export const config: Config = {
	// Netlify evaluates cron in UTC: 7 AM PST and 8 AM PDT.
	schedule: "0 15 * * *",
};
