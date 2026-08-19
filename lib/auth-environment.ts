const LOCAL_AUTH_HOSTS = [
	"localhost:3000",
	"localhost:8888",
	"127.0.0.1:3000",
	"127.0.0.1:8888",
] as const;

const NETLIFY_DEPLOY_URL_KEYS = [
	"URL",
	"DEPLOY_PRIME_URL",
	"DEPLOY_URL",
] as const;

const NETLIFY_SITE_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type AuthEnvironment = Partial<
	Pick<
		NodeJS.ProcessEnv,
		| "BETTER_AUTH_ALLOWED_HOSTS"
		| "BETTER_AUTH_URL"
		| "DEPLOY_PRIME_URL"
		| "DEPLOY_URL"
		| "NETLIFY"
		| "NODE_ENV"
		| "SITE_ID"
		| "SITE_NAME"
		| "URL"
	>
>;

export interface AuthBaseUrlConfig {
	allowedHosts: string[];
	fallback?: string;
	protocol: "http" | "https";
}

function getValue(value: string | undefined) {
	const normalizedValue = value?.trim();
	return normalizedValue || undefined;
}

function getHttpUrl(value: string | undefined) {
	const normalizedValue = getValue(value);

	if (!normalizedValue) {
		return undefined;
	}

	try {
		const url = new URL(normalizedValue);

		if (
			(url.protocol !== "http:" && url.protocol !== "https:") ||
			!url.host ||
			url.username ||
			url.password
		) {
			return undefined;
		}

		return url;
	} catch {
		return undefined;
	}
}

function isNetlifyEnvironment(environment: AuthEnvironment) {
	return (
		environment.NETLIFY === "true" ||
		Boolean(getValue(environment.SITE_ID) && getValue(environment.SITE_NAME))
	);
}

function getNetlifySiteName(value: string | undefined) {
	const siteName = getValue(value)?.toLowerCase();

	return siteName && NETLIFY_SITE_NAME_PATTERN.test(siteName)
		? siteName
		: undefined;
}

export function getAuthBaseUrlConfig(
	environment: AuthEnvironment = process.env,
): AuthBaseUrlConfig {
	const configuredHosts = (environment.BETTER_AUTH_ALLOWED_HOSTS ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean);
	const hosts = new Set(configuredHosts);
	const explicitFallback = getValue(environment.BETTER_AUTH_URL);
	const explicitFallbackUrl = getHttpUrl(explicitFallback);
	const isNetlify = isNetlifyEnvironment(environment);

	if (explicitFallbackUrl) {
		hosts.add(explicitFallbackUrl.host);
	}

	if (isNetlify && configuredHosts.length === 0) {
		for (const key of NETLIFY_DEPLOY_URL_KEYS) {
			const url = getHttpUrl(environment[key]);

			if (url) {
				hosts.add(url.host);
			}
		}

		const siteName = getNetlifySiteName(environment.SITE_NAME);

		if (siteName) {
			hosts.add(`${siteName}.netlify.app`);
			hosts.add(`*--${siteName}.netlify.app`);
		}
	}

	if (hosts.size === 0 && !isNetlify) {
		for (const host of LOCAL_AUTH_HOSTS) {
			hosts.add(host);
		}
	}

	const netlifyFallback = isNetlify
		? getHttpUrl(environment.URL)?.origin
		: undefined;
	const fallback = explicitFallback ?? netlifyFallback;

	return {
		allowedHosts: [...hosts],
		...(fallback ? { fallback } : {}),
		protocol: environment.NODE_ENV === "production" ? "https" : "http",
	};
}
