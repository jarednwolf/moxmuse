import { EventEmitter } from 'events';

export interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'vercel' | 'custom';
  baseUrl: string;
  apiKey?: string;
  zoneId?: string;
  distributionId?: string;
  enableCompression: boolean;
  enableCaching: boolean;
  defaultTTL: number;
  maxAge: number;
}

export interface AssetOptimization {
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  quality: number;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface CachePolicy {
  path: string;
  ttl: number;
  headers: Record<string, string>;
  conditions?: {
    fileExtensions?: string[];
    pathPatterns?: string[];
    contentTypes?: string[];
  };
}

export interface CDNMetrics {
  totalRequests: number;
  cacheHitRate: number;
  bandwidthSaved: number;
  averageResponseTime: number;
  errorRate: number;
  topAssets: Array<{
    path: string;
    requests: number;
    bandwidth: number;
  }>;
}

export class CDNService extends EventEmitter {
  private config: CDNConfig;
  private cachePolicies: Map<string, CachePolicy> = new Map();
  private metrics: CDNMetrics;

  constructor(config: CDNConfig) {
    super();
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      cacheHitRate: 0,
      bandwidthSaved: 0,
      averageResponseTime: 0,
      errorRate: 0,
      topAssets: [],
    };

    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    // Static assets - long cache
    this.addCachePolicy('static-assets', {
      path: '/static/*',
      ttl: 31536000, // 1 year
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept-Encoding',
      },
      conditions: {
        fileExtensions: ['.js', '.css', '.woff2', '.woff', '.ttf', '.eot'],
      },
    });

    // Images - medium cache with optimization
    this.addCachePolicy('images', {
      path: '/images/*',
      ttl: 86400, // 1 day
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'Vary': 'Accept, Accept-Encoding',
      },
      conditions: {
        fileExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg'],
      },
    });

    // API responses - short cache
    this.addCachePolicy('api', {
      path: '/api/*',
      ttl: 300, // 5 minutes
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Vary': 'Accept-Encoding, Authorization',
      },
    });

    // HTML pages - very short cache
    this.addCachePolicy('pages', {
      path: '/*',
      ttl: 60, // 1 minute
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Vary': 'Accept-Encoding',
      },
      conditions: {
        contentTypes: ['text/html'],
      },
    });
  }

  addCachePolicy(name: string, policy: CachePolicy): void {
    this.cachePolicies.set(name, policy);
    this.emit('policyAdded', { name, policy });
  }

  removeCachePolicy(name: string): void {
    this.cachePolicies.delete(name);
    this.emit('policyRemoved', { name });
  }

  getCachePolicy(path: string): CachePolicy | null {
    for (const [name, policy] of this.cachePolicies) {
      if (this.matchesPolicy(path, policy)) {
        return policy;
      }
    }
    return null;
  }

  private matchesPolicy(path: string, policy: CachePolicy): boolean {
    // Simple glob pattern matching
    const pattern = policy.path.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    
    if (!regex.test(path)) {
      return false;
    }

    // Check additional conditions
    if (policy.conditions) {
      const { fileExtensions, pathPatterns } = policy.conditions;
      
      if (fileExtensions) {
        const hasMatchingExtension = fileExtensions.some(ext => path.endsWith(ext));
        if (!hasMatchingExtension) return false;
      }
      
      if (pathPatterns) {
        const hasMatchingPattern = pathPatterns.some(pattern => {
          const patternRegex = new RegExp(pattern.replace(/\*/g, '.*'));
          return patternRegex.test(path);
        });
        if (!hasMatchingPattern) return false;
      }
    }

    return true;
  }

  optimizeImageUrl(originalUrl: string, optimization: AssetOptimization): string {
    const { format, quality, width, height, fit } = optimization;
    const params = new URLSearchParams();

    params.set('format', format);
    params.set('quality', quality.toString());
    
    if (width) params.set('width', width.toString());
    if (height) params.set('height', height.toString());
    if (fit) params.set('fit', fit);

    return `${this.config.baseUrl}/image-optimization?url=${encodeURIComponent(originalUrl)}&${params.toString()}`;
  }

  generateResponsiveImageSet(originalUrl: string, sizes: number[]): {
    srcSet: string;
    sizes: string;
  } {
    const srcSet = sizes.map(size => {
      const optimizedUrl = this.optimizeImageUrl(originalUrl, {
        format: 'webp',
        quality: 85,
        width: size,
        fit: 'cover',
      });
      return `${optimizedUrl} ${size}w`;
    }).join(', ');

    const sizesAttr = sizes.map((size, index) => {
      if (index === sizes.length - 1) return `${size}px`;
      return `(max-width: ${size}px) ${size}px`;
    }).join(', ');

    return { srcSet, sizes: sizesAttr };
  }

  async purgeCache(paths: string[] | 'all'): Promise<void> {
    try {
      if (this.config.provider === 'cloudflare' && this.config.apiKey && this.config.zoneId) {
        await this.purgeCloudflareCache(paths);
      } else if (this.config.provider === 'aws' && this.config.distributionId) {
        await this.purgeAWSCache(paths);
      } else if (this.config.provider === 'vercel') {
        await this.purgeVercelCache(paths);
      }

      this.emit('cachePurged', { paths });
    } catch (error) {
      this.emit('purgeFailed', { paths, error });
      throw error;
    }
  }

  private async purgeCloudflareCache(paths: string[] | 'all'): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/purge_cache`;
    
    const body = paths === 'all' 
      ? { purge_everything: true }
      : { files: Array.isArray(paths) ? paths : [paths] };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare cache purge failed: ${response.statusText}`);
    }
  }

  private async purgeAWSCache(paths: string[] | 'all'): Promise<void> {
    // AWS CloudFront cache invalidation would go here
    // This is a placeholder for the actual AWS SDK implementation
    console.log('AWS cache purge not implemented yet');
  }

  private async purgeVercelCache(paths: string[] | 'all'): Promise<void> {
    // Vercel cache purge would go here
    // This is a placeholder for the actual Vercel API implementation
    console.log('Vercel cache purge not implemented yet');
  }

  async preloadAssets(urls: string[]): Promise<void> {
    const preloadPromises = urls.map(async (url) => {
      try {
        // Trigger a request to warm the cache
        await fetch(url, { method: 'HEAD' });
        this.emit('assetPreloaded', { url });
      } catch (error) {
        this.emit('preloadFailed', { url, error });
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  generateCacheHeaders(path: string): Record<string, string> {
    const policy = this.getCachePolicy(path);
    
    if (!policy) {
      return {
        'Cache-Control': 'no-cache',
      };
    }

    return policy.headers;
  }

  async getMetrics(): Promise<CDNMetrics> {
    // In a real implementation, this would fetch metrics from the CDN provider
    return { ...this.metrics };
  }

  async analyzeCachePerformance(): Promise<{
    hitRate: number;
    missRate: number;
    bandwidthSaved: number;
    recommendations: string[];
  }> {
    const metrics = await this.getMetrics();
    const recommendations: string[] = [];

    if (metrics.cacheHitRate < 0.8) {
      recommendations.push('Consider increasing cache TTL for static assets');
    }

    if (metrics.errorRate > 0.05) {
      recommendations.push('High error rate detected, check CDN configuration');
    }

    if (metrics.averageResponseTime > 200) {
      recommendations.push('Consider optimizing asset sizes or adding more edge locations');
    }

    return {
      hitRate: metrics.cacheHitRate,
      missRate: 1 - metrics.cacheHitRate,
      bandwidthSaved: metrics.bandwidthSaved,
      recommendations,
    };
  }

  getOptimalImageFormat(userAgent: string): 'avif' | 'webp' | 'jpeg' {
    if (userAgent.includes('Chrome') && userAgent.includes('Chrome/')) {
      const chromeVersion = parseInt(userAgent.match(/Chrome\/(\d+)/)?.[1] || '0');
      if (chromeVersion >= 85) return 'avif';
      if (chromeVersion >= 23) return 'webp';
    }
    
    if (userAgent.includes('Firefox')) {
      const firefoxVersion = parseInt(userAgent.match(/Firefox\/(\d+)/)?.[1] || '0');
      if (firefoxVersion >= 93) return 'avif';
      if (firefoxVersion >= 65) return 'webp';
    }
    
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      const safariVersion = parseInt(userAgent.match(/Version\/(\d+)/)?.[1] || '0');
      if (safariVersion >= 14) return 'webp';
    }

    return 'jpeg';
  }
}