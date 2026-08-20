import {
	AUTH_EMAIL_APP_NAME,
	AuthEmailLayout,
} from "@/emails/auth-email-layout";

export interface VerificationEmailProps {
	url?: string;
	userName?: string;
}

export function VerificationEmail({
	url = "https://example.com/api/auth/verify-email?token=preview",
	userName = "SacTech member",
}: VerificationEmailProps = {}) {
	return (
		<AuthEmailLayout
			actionLabel="Verify email"
			description={`Confirm this email address to finish creating your ${AUTH_EMAIL_APP_NAME} account. This link expires in one hour.`}
			heading="Verify your email"
			ignoreMessage={`If you did not create a ${AUTH_EMAIL_APP_NAME} account, you can ignore this email.`}
			preview={`Verify your ${AUTH_EMAIL_APP_NAME} email`}
			url={url}
			userName={userName}
		/>
	);
}

export default VerificationEmail;
