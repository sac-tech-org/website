import { describe, expect, it } from "vitest";
import { getAuthBaseUrlConfig } from "@/lib/auth-environment";

describe("getAuthBaseUrlConfig", () => {
	it("uses local development hosts outside Netlify", () => {
		expect(getAuthBaseUrlConfig({ NODE_ENV: "development" })).toEqual({
			allowedHosts: [
				"localhost:3000",
				"localhost:8888",
				"127.0.0.1:3000",
				"127.0.0.1:8888",
			],
			protocol: "http",
		});
	});

	it("derives the production URL and site-scoped Netlify hosts at runtime", () => {
		expect(
			getAuthBaseUrlConfig({
				NODE_ENV: "production",
				SITE_ID: "site-id",
				SITE_NAME: "sac-tech-events",
				URL: "https://events.sactech.org",
			}),
		).toEqual({
			allowedHosts: [
				"events.sactech.org",
				"sac-tech-events.netlify.app",
				"*--sac-tech-events.netlify.app",
			],
			fallback: "https://events.sactech.org",
			protocol: "https",
		});
	});

	it("adds exact deploy URLs when Netlify exposes them during a build", () => {
		expect(
			getAuthBaseUrlConfig({
				DEPLOY_PRIME_URL:
					"https://deploy-preview-42--sac-tech-events.netlify.app",
				DEPLOY_URL: "https://deploy-id--sac-tech-events.netlify.app",
				NETLIFY: "true",
				NODE_ENV: "production",
				SITE_NAME: "sac-tech-events",
				URL: "https://sac-tech-events.netlify.app",
			}),
		).toEqual({
			allowedHosts: [
				"sac-tech-events.netlify.app",
				"deploy-preview-42--sac-tech-events.netlify.app",
				"deploy-id--sac-tech-events.netlify.app",
				"*--sac-tech-events.netlify.app",
			],
			fallback: "https://sac-tech-events.netlify.app",
			protocol: "https",
		});
	});

	it("prefers the explicit fallback while retaining automatic Netlify hosts", () => {
		expect(
			getAuthBaseUrlConfig({
				BETTER_AUTH_URL: " https://auth.sactech.org/api/auth ",
				NETLIFY: "true",
				NODE_ENV: "production",
				SITE_NAME: "sac-tech-events",
				URL: "https://events.sactech.org",
			}),
		).toEqual({
			allowedHosts: [
				"auth.sactech.org",
				"events.sactech.org",
				"sac-tech-events.netlify.app",
				"*--sac-tech-events.netlify.app",
			],
			fallback: "https://auth.sactech.org/api/auth",
			protocol: "https",
		});
	});

	it("treats an explicit host list as an override and adds its fallback host", () => {
		expect(
			getAuthBaseUrlConfig({
				BETTER_AUTH_ALLOWED_HOSTS:
					"members.sactech.org, preview.sactech.org, members.sactech.org",
				BETTER_AUTH_URL: "https://events.sactech.org",
				NETLIFY: "true",
				NODE_ENV: "production",
				SITE_NAME: "sac-tech-events",
				URL: "https://sac-tech-events.netlify.app",
			}),
		).toEqual({
			allowedHosts: [
				"members.sactech.org",
				"preview.sactech.org",
				"events.sactech.org",
			],
			fallback: "https://events.sactech.org",
			protocol: "https",
		});
	});

	it("does not treat a generic URL variable as Netlify metadata", () => {
		expect(
			getAuthBaseUrlConfig({
				NODE_ENV: "production",
				URL: "https://unrelated.example.com",
			}),
		).toEqual({
			allowedHosts: [
				"localhost:3000",
				"localhost:8888",
				"127.0.0.1:3000",
				"127.0.0.1:8888",
			],
			protocol: "https",
		});
	});

	it("fails closed when Netlify metadata cannot produce a safe host", () => {
		expect(
			getAuthBaseUrlConfig({
				DEPLOY_PRIME_URL: "javascript:alert(1)",
				NETLIFY: "true",
				NODE_ENV: "production",
				SITE_NAME: "bad*site",
				URL: "not a URL",
			}),
		).toEqual({
			allowedHosts: [],
			protocol: "https",
		});
	});
});
