/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'bufferutil': false,
      'utf-8-validate': false,
      'ws': false,
    };
    return config;
  },
};

module.exports = nextConfig;
