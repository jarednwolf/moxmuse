/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@moxmuse/api', '@moxmuse/db', '@moxmuse/shared'],
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['cards.scryfall.io', 'c1.scryfall.com'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cards.scryfall.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'c1.scryfall.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-dialog', 
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@tanstack/react-query',
      '@tanstack/react-virtual',
      'framer-motion',
    ],
    serverComponentsExternalPackages: ['@prisma/client'],
    optimizeCss: true,
    webVitalsAttribution: ['CLS', 'LCP'],
  },
  webpack: (config, { dev, isServer, webpack }) => {
    // Optimize bundle splitting
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          // Framework chunk (React, Next.js)
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // UI components chunk
          ui: {
            name: 'ui',
            chunks: 'all',
            test: /[\\/](components[\\/]ui|@radix-ui)[\\/]/,
            priority: 30,
            minChunks: 1,
          },
          // Tutor-specific components
          tutor: {
            name: 'tutor',
            chunks: 'all',
            test: /[\\/]components[\\/]tutor[\\/]/,
            priority: 25,
            minChunks: 1,
          },
          // Virtualization libraries
          virtualization: {
            name: 'virtualization',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]@tanstack[\\/]react-virtual[\\/]/,
            priority: 22,
            enforce: true,
          },
          // Query and state management
          query: {
            name: 'query',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@tanstack[\\/]react-query|zustand)[\\/]/,
            priority: 20,
            enforce: true,
          },
          // Animation libraries
          animation: {
            name: 'animation',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            priority: 18,
            enforce: true,
          },
          // Icons
          icons: {
            name: 'icons',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            priority: 15,
            enforce: true,
          },
          // Utilities
          utils: {
            name: 'utils',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](clsx|class-variance-authority|tailwind-merge)[\\/]/,
            priority: 12,
            enforce: true,
          },
          // Common vendor libraries
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]/,
            priority: 10,
            minChunks: 2,
          },
          // Default group
          default: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      }

      // Add module concatenation for better tree shaking
      config.optimization.concatenateModules = true
      
      // Enable module ids optimization
      config.optimization.moduleIds = 'deterministic'
      config.optimization.chunkIds = 'deterministic'
    }

    // Add bundle analyzer in development
    if (dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      )
    }

    // Optimize imports
    config.resolve.alias = {
      ...config.resolve.alias,
      // Optimize lodash imports
      'lodash': 'lodash-es',
    }

    return config
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
