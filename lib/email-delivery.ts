interface EmailDeliveryEnvironment {
	[key: string]: string | undefined;
	CONTEXT?: string;
	EMAIL_DELIVERY_MODE?: string;
	NETLIFY_PREVIEW_SERVER?: string;
	NODE_ENV?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
}

function getValue(value: string | undefined) {
	return value?.trim() || undefined;
}

export function isLocalDevelopmentEnvironment(
	environment: EmailDeliveryEnvironment = process.env,
) {
	if (getValue(environment.NETLIFY_PREVIEW_SERVER) === "true") {
		return false;
	}

	const netlifyContext = getValue(environment.CONTEXT);

	if (netlifyContext) {
		return netlifyContext === "dev";
	}

	return environment.NODE_ENV === "development";
}

/**
 * Deployed environments always keep account verification enabled. Local
 * development opts in explicitly with live mode and both server-only Resend
 * settings.
 */
export function isEmailDeliveryEnabled(
	environment: EmailDeliveryEnvironment = process.env,
) {
	const mode = getValue(environment.EMAIL_DELIVERY_MODE);

	if (mode && mode !== "live") {
		throw new Error("EMAIL_DELIVERY_MODE must be set to live or left unset");
	}

	if (!isLocalDevelopmentEnvironment(environment)) {
		return true;
	}
	if (mode !== "live") {
		return false;
	}

	const hasApiKey = Boolean(getValue(environment.RESEND_API_KEY));
	const hasFromEmail = Boolean(getValue(environment.RESEND_FROM_EMAIL));

	if (hasApiKey !== hasFromEmail) {
		throw new Error(
			"Live local email delivery requires both RESEND_API_KEY and RESEND_FROM_EMAIL",
		);
	}
	if (!hasApiKey) {
		throw new Error(
			"Live local email delivery requires both RESEND_API_KEY and RESEND_FROM_EMAIL",
		);
	}

	return true;
}
