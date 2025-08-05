/** @type {import('next').NextConfig} */

const path = require('path')

// Bundle analyzer for development
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  // Experimental features for performance
  experimental: {
    // Enable modern JavaScript features
    esmExternals: true,
    // Optimize server components
    serverComponentsExternalPackages: ['@prisma/client'],
    // Enable concurrent features
    concurrentFeatures: true,
    // Optimize CSS
    optimizeCss: true,
    // Enable SWC minification
    swcMinify: true,
    // Enable modern bundling
    modularizeImports: {
      'lucide-react': {
        transform: 'lucide-react/dist/esm/icons/{{member}}',
        skipDefaultConversion: true,
      },
      '@radix-ui/react-icons': {
        transform: '@radix-ui/react-icons/dist/{{member}}.js',
        skipDefaultConversion: true,
      },
    },
  },

  // Webpack optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Production optimizations
    if (!dev) {
      // Split chunks optimization
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk for stable dependencies
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // UI library chunk
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|framer-motion)[\\/]/,
              name: 'ui-libs',
              priority: 20,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // React ecosystem chunk
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|react-query)[\\/]/,
              name: 'react-vendor',
              priority: 30,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // tRPC and API chunk
            api: {
              test: /[\\/]node_modules[\\/](@trpc|@tanstack)[\\/]/,
              name: 'api-libs',
              priority: 25,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // Utilities chunk
            utils: {
              test: /[\\/]node_modules[\\/](lodash|date-fns|zod|clsx|tailwind-merge)[\\/]/,
              name: 'utils',
              priority: 15,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // Common components chunk
            common: {
              name: 'common',
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
              chunks: 'all',
            },
          },
        },
      }

      // Tree shaking optimization
      config.optimization.usedExports = true
      config.optimization.sideEffects = false

      // Module concatenation
      config.optimization.concatenateModules = true

      // Minimize bundle size
      config.optimization.minimize = true
    }

    // Resolve optimizations
    config.resolve.alias = {
      ...config.resolve.alias,
      // Optimize React imports
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      // Optimize common libraries
      '@': path.resolve(__dirname, 'src'),
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/hooks': path.resolve(__dirname, 'src/hooks'),
    }

    // Externalize heavy dependencies for server
    if (isServer) {
      config.externals = [
        ...config.externals,
        // Externalize Prisma client
        '@prisma/client',
        // Externalize heavy Node.js modules
        'bcryptjs',
        'sharp',
      ]
    }

    // Plugin optimizations
    config.plugins.push(
      // Define environment variables at build time
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(dev),
        __PROD__: JSON.stringify(!dev),
        __BUILD_ID__: JSON.stringify(buildId),
      }),

      // Ignore moment.js locales to reduce bundle size
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),

      // Provide polyfills only when needed
      new webpack.ProvidePlugin({
        // Only provide if used
        process: 'process/browser',
      })
    )

    // Module rules optimization
    config.module.rules.push(
      // Optimize SVG imports
      {
        test: /\.svg$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgo: true,
              svgoConfig: {
                plugins: [
                  {
                    name: 'preset-default',
                    params: {
                      overrides: {
                        removeViewBox: false,
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },

      // Optimize image imports
      {
        test: /\.(png|jpe?g|gif|webp)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              publicPath: '/_next/static/images/',
              outputPath: 'static/images/',
              name: '[name].[hash].[ext]',
            },
          },
          {
            loader: 'image-webpack-loader',
            options: {
              mozjpeg: {
                progressive: true,
                quality: 85,
              },
              optipng: {
                enabled: false,
              },
              pngquant: {
                quality: [0.65, 0.90],
                speed: 4,
              },
              gifsicle: {
                interlaced: false,
              },
              webp: {
                quality: 85,
              },
            },
          },
        ],
      }
    )

    return config
  },

  // Image optimization
  images: {
    // Enable modern image formats
    formats: ['image/webp', 'image/avif'],
    // Optimize image loading
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable image optimization
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    // External image domains
    domains: [
      'cards.scryfall.io',
      'c1.scryfall.com',
      'gatherer.wizards.com',
    ],
    // Image loader configuration
    loader: 'default',
    // Disable static imports for better tree shaking
    dangerouslyAllowSVG: false,
  },

  // Compression and caching
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Redirects for SEO
  async redirects() {
    return [
      // Add any necessary redirects here
    ]
  },

  // Rewrites for API optimization
  async rewrites() {
    return [
      // Add any necessary rewrites here
    ]
  },

  // Output configuration
  output: 'standalone',
  
  // Disable source maps in production for smaller bundles
  productionBrowserSourceMaps: false,

  // Optimize fonts
  optimizeFonts: true,

  // Enable SWC compiler
  swcMinify: true,

  // Strict mode for better performance
  reactStrictMode: true,

  // TypeScript configuration
  typescript: {
    // Type checking is handled by CI/CD
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Linting is handled by CI/CD
    ignoreDuringBuilds: false,
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Trailing slash configuration
  trailingSlash: false,

  // Base path for deployment
  basePath: '',

  // Asset prefix for CDN
  assetPrefix: process.env.NODE_ENV === 'production' ? process.env.CDN_URL || '' : '',
}

module.exports = withBundleAnalyzer(nextConfig)