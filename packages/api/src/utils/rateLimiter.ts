// Simple rate limiter for external API calls
class RateLimiter {
  private queue: Array<() => void> = []
  private processing = false
  private lastRequestTime = 0
  private minInterval: number // milliseconds between requests

  constructor(requestsPerSecond: number) {
    this.minInterval = 1000 / requestsPerSecond
  }

  async limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false
      return
    }

    this.processing = true
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest)

    setTimeout(async () => {
      const task = this.queue.shift()
      if (task) {
        this.lastRequestTime = Date.now()
        await task()
        this.processQueue()
      }
    }, waitTime)
  }
}

// Create a rate limiter for Moxfield API (5 requests per second)
export const moxfieldRateLimiter = new RateLimiter(4) // Conservative: 4/sec instead of 5

// Create a rate limiter for Archidekt API
export const archidektRateLimiter = new RateLimiter(10)

// Create a rate limiter for Scryfall API (conservative: 8 requests per second)
export const scryfallRateLimiter = new RateLimiter(8) // Well under their 10/sec limit 