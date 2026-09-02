/** @type {import('next').NextConfig} */
const devTunnelOrigin = process.env.SAC_TECH_DEV_ORIGIN;

const nextConfig = {
	cacheComponents: true,
	experimental: {
		serverActions: {
			// Event header images are capped at 3 MB. Leave room for the rest of
			// the event form and multipart encoding overhead.
			bodySizeLimit: "4mb",
		},
	},
	reactStrictMode: true,
	...(devTunnelOrigin ? { allowedDevOrigins: [devTunnelOrigin] } : {}),
};

module.exports = nextConfig;
