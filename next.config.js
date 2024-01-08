/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      readline: false,
    };
    config.experiments = { asyncWebAssembly: true };
    return config;
  },
};

module.exports = nextConfig;
