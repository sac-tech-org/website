import {
	AUTH_EMAIL_APP_NAME,
	AuthEmailLayout,
} from "@/emails/auth-email-layout";

export interface PasswordResetEmailProps {
	url?: string;
	userName?: string;
}

export function PasswordResetEmail({
	url = "https://example.com/api/auth/reset-password/preview",
	userName = "SacTech member",
}: PasswordResetEmailProps = {}) {
	return (
		<AuthEmailLayout
			actionLabel="Reset password"
			description={`Use this link to choose a new password for your ${AUTH_EMAIL_APP_NAME} account. This link expires in one hour.`}
			heading="Reset your password"
			ignoreMessage="If you did not request a password reset, you can ignore this email. Your password has not changed."
			preview={`Reset your ${AUTH_EMAIL_APP_NAME} password`}
			url={url}
			userName={userName}
		/>
	);
}

export default PasswordResetEmail;
