import type { ReactElement } from "react";
import { Resend } from "resend";
import {
	AUTH_EMAIL_APP_NAME,
	normalizeEmailUserName,
} from "@/emails/auth-email-layout";
import PasswordResetEmail from "@/emails/reset-password";
import VerificationEmail from "@/emails/verify-email";

const EMAIL_ADDRESS_PATTERN =
	/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

interface AuthEmailEnvironment {
	[key: string]: string | undefined;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
}

interface AuthEmailConfig {
	apiKey: string;
	fromEmail: string;
}

interface AuthEmailProps {
	url: string;
	userName?: string;
}

interface SendAuthEmailOptions extends AuthEmailProps {
	to: string;
}

interface AuthEmailContent {
	react: ReactElement;
	subject: string;
	text: string;
}

function getValue(value: string | undefined) {
	const normalizedValue = value?.trim();
	return normalizedValue || undefined;
}

function isValidFromEmail(value: string) {
	if (value.includes("\r") || value.includes("\n")) {
		return false;
	}

	const namedAddress = value.match(/^[^<>]+<([^<>]+)>$/);
	const address = (namedAddress?.[1] ?? value).trim();

	return EMAIL_ADDRESS_PATTERN.test(address);
}

export function getAuthEmailConfig(
	environment: AuthEmailEnvironment = process.env,
): AuthEmailConfig {
	const apiKey = getValue(environment.RESEND_API_KEY);
	const fromEmail = getValue(environment.RESEND_FROM_EMAIL);
	const issues: string[] = [];

	if (!apiKey) {
		issues.push("RESEND_API_KEY must be set");
	} else if (/\s/.test(apiKey)) {
		issues.push("RESEND_API_KEY must not contain whitespace");
	}

	if (!fromEmail) {
		issues.push("RESEND_FROM_EMAIL must be set");
	} else if (!isValidFromEmail(fromEmail)) {
		issues.push(
			"RESEND_FROM_EMAIL must be an email address or a Display Name <email@example.com> sender",
		);
	}

	if (issues.length > 0) {
		throw new Error(`Invalid auth email configuration: ${issues.join("; ")}`);
	}

	return {
		apiKey: apiKey as string,
		fromEmail: fromEmail as string,
	};
}

function getActionUrl(value: string) {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		throw new Error("Auth email action URL must be an absolute HTTP(S) URL");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Auth email action URL must be an absolute HTTP(S) URL");
	}

	return url.href;
}

export function createVerificationEmail({
	url,
	userName,
}: AuthEmailProps): AuthEmailContent {
	const actionUrl = getActionUrl(url);
	const normalizedName = normalizeEmailUserName(userName);

	return {
		react: VerificationEmail({
			url: actionUrl,
			userName: normalizedName,
		}),
		subject: `Verify your ${AUTH_EMAIL_APP_NAME} email`,
		text: [
			normalizedName ? `Hi ${normalizedName},` : "Hi,",
			"",
			`Confirm this email address to finish creating your ${AUTH_EMAIL_APP_NAME} account. This link expires in one hour.`,
			"",
			actionUrl,
			"",
			`If you did not create a ${AUTH_EMAIL_APP_NAME} account, you can ignore this email.`,
		].join("\n"),
	};
}

export function createPasswordResetEmail({
	url,
	userName,
}: AuthEmailProps): AuthEmailContent {
	const actionUrl = getActionUrl(url);
	const normalizedName = normalizeEmailUserName(userName);

	return {
		react: PasswordResetEmail({
			url: actionUrl,
			userName: normalizedName,
		}),
		subject: `Reset your ${AUTH_EMAIL_APP_NAME} password`,
		text: [
			normalizedName ? `Hi ${normalizedName},` : "Hi,",
			"",
			`Use this link to choose a new password for your ${AUTH_EMAIL_APP_NAME} account. This link expires in one hour.`,
			"",
			actionUrl,
			"",
			"If you did not request a password reset, you can ignore this email. Your password has not changed.",
		].join("\n"),
	};
}

async function sendAuthEmail(
	{ to, ...templateProps }: SendAuthEmailOptions,
	content: (props: AuthEmailProps) => AuthEmailContent,
) {
	const { apiKey, fromEmail } = getAuthEmailConfig();
	const resend = new Resend(apiKey);
	const email = content(templateProps);
	const { error } = await resend.emails.send({
		from: fromEmail,
		react: email.react,
		subject: email.subject,
		text: email.text,
		to,
	});

	if (error) {
		throw new Error(`Resend failed to send auth email: ${error.message}`, {
			cause: error,
		});
	}
}

export async function sendVerificationEmail(options: SendAuthEmailOptions) {
	await sendAuthEmail(options, createVerificationEmail);
}

export async function sendPasswordResetEmail(options: SendAuthEmailOptions) {
	await sendAuthEmail(options, createPasswordResetEmail);
}
