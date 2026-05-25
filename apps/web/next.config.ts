import path from 'path';
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Pin monorepo root so Next doesn’t pick another pnpm-lock.yaml (e.g. in $HOME) and break routes in dev.
const workspaceRoot = path.join(__dirname, '../..');

const nextConfig: NextConfig = {
  // Standalone build → minimal node_modules copy used by the Docker image (apps/web/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ['@safetag/shared'],
  // Required for three-globe and leaflet which use browser globals
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent server-side bundling of browser-only modules
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'leaflet',
        'three-globe',
      ];
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
