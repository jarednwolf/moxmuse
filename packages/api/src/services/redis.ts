import Redis from 'ioredis'

let redis: Redis | null = null
let isConnected = false

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('Redis connection failed after 3 retries, falling back to no-cache mode')
        return null
      }
      return Math.min(times * 100, 3000)
    },
    lazyConnect: true,
  })
  
  redis.on('connect', () => {
    isConnected = true
    console.log('Redis connected successfully')
  })
  
  redis.on('error', (err) => {
    console.error('Redis connection error:', err)
    isConnected = false
  })
  
  // Try to connect
  redis.connect().catch(err => {
    console.warn('Redis initial connection failed:', err)
    isConnected = false
  })
} catch (error) {
  console.warn('Redis initialization failed:', error)
}

export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redis || !isConnected) return null
    
    try {
      const value = await redis.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (error) {
      console.error('Redis get error:', error)
      return null
    }
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!redis || !isConnected) return
    
    try {
      const serialized = JSON.stringify(value)
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized)
      } else {
        await redis.set(key, serialized)
      }
    } catch (error) {
      console.error('Redis set error:', error)
    }
  },

  async del(key: string): Promise<void> {
    if (!redis || !isConnected) return
    
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Redis del error:', error)
    }
  },

  async flush(): Promise<void> {
    if (!redis || !isConnected) return
    
    try {
      await redis.flushdb()
    } catch (error) {
      console.error('Redis flush error:', error)
    }
  },

  async keys(pattern: string): Promise<string[]> {
    if (!redis || !isConnected) return []
    
    try {
      return await redis.keys(pattern)
    } catch (error) {
      console.error('Redis keys error:', error)
      return []
    }
  },

  async lpush(key: string, value: string): Promise<number> {
    if (!redis || !isConnected) return 0
    
    try {
      return await redis.lpush(key, value)
    } catch (error) {
      console.error('Redis lpush error:', error)
      return 0
    }
  },

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!redis || !isConnected) return []
    
    try {
      return await redis.lrange(key, start, stop)
    } catch (error) {
      console.error('Redis lrange error:', error)
      return []
    }
  },

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    if (!redis || !isConnected) return
    
    try {
      await redis.ltrim(key, start, stop)
    } catch (error) {
      console.error('Redis ltrim error:', error)
    }
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (!redis || !isConnected) return
    
    try {
      await redis.expire(key, seconds)
    } catch (error) {
      console.error('Redis expire error:', error)
    }
  },

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!redis || !isConnected) return
    
    try {
      await redis.setex(key, seconds, value)
    } catch (error) {
      console.error('Redis setex error:', error)
    }
  },
} 