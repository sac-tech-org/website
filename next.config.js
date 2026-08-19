/** @type {import('next').NextConfig} */
const devTunnelOrigin = process.env.SAC_TECH_DEV_ORIGIN

const nextConfig = {
  reactStrictMode: true,
  ...(devTunnelOrigin ? { allowedDevOrigins: [devTunnelOrigin] } : {}),
}

module.exports = nextConfig
