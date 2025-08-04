// Service Worker for offline deck viewing and caching
const CACHE_NAME = 'deckforge-v1'
const OFFLINE_CACHE = 'deckforge-offline-v1'
const DECK_CACHE = 'deckforge-decks-v1'
const CARD_IMAGE_CACHE = 'deckforge-card-images-v1'

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.ico',
  // Add other critical static assets
]

// API endpoints to cache
const CACHEABLE_APIS = [
  '/api/trpc/deck.getDeck',
  '/api/trpc/deck.getDecks',
  '/api/trpc/collection.getCollection',
  '/api/trpc/cards.search'
]

// Card image domains to cache
const CARD_IMAGE_DOMAINS = [
  'cards.scryfall.io',
  'gatherer.wizards.com'
]

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting()
      })
  )
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== CACHE_NAME && 
                cacheName !== OFFLINE_CACHE && 
                cacheName !== DECK_CACHE &&
                cacheName !== CARD_IMAGE_CACHE) {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        // Take control of all pages
        return self.clients.claim()
      })
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Handle different types of requests
  if (request.method === 'GET') {
    if (isCardImageRequest(url)) {
      event.respondWith(handleCardImageRequest(request))
    } else if (isAPIRequest(url)) {
      event.respondWith(handleAPIRequest(request))
    } else if (isDeckPageRequest(url)) {
      event.respondWith(handleDeckPageRequest(request))
    } else {
      event.respondWith(handleStaticRequest(request))
    }
  }
})

// Handle card image requests with aggressive caching
async function handleCardImageRequest(request) {
  const cache = await caches.open(CARD_IMAGE_CACHE)
  
  try {
    // Try cache first
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fetch from network
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Card image fetch failed:', error)
    
    // Return placeholder image if available
    const placeholderResponse = await cache.match('/images/card-placeholder.png')
    if (placeholderResponse) {
      return placeholderResponse
    }
    
    // Return empty response as fallback
    return new Response('', { status: 404 })
  }
}

// Handle API requests with intelligent caching
async function handleAPIRequest(request) {
  const url = new URL(request.url)
  const cache = await caches.open(DECK_CACHE)
  
  // Check if this API should be cached
  const shouldCache = CACHEABLE_APIS.some(api => url.pathname.includes(api))
  
  if (!shouldCache) {
    return fetch(request)
  }
  
  try {
    // Try network first for fresh data
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
    
    throw new Error('Network response not ok')
  } catch (error) {
    console.log('API request failed, trying cache:', error)
    
    // Fallback to cache
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      // Add offline indicator header
      const response = cachedResponse.clone()
      response.headers.set('X-Served-From', 'cache')
      return response
    }
    
    // Return offline response for deck-related APIs
    if (url.pathname.includes('deck')) {
      return createOfflineDeckResponse()
    }
    
    throw error
  }
}

// Handle deck page requests
async function handleDeckPageRequest(request) {
  const cache = await caches.open(CACHE_NAME)
  
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache the page
      cache.put(request, networkResponse.clone())
      return networkResponse
    }
    
    throw new Error('Network response not ok')
  } catch (error) {
    console.log('Deck page request failed, trying cache:', error)
    
    // Try cache
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline deck page
    return cache.match('/offline') || createOfflineResponse()
  }
}

// Handle static asset requests
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME)
  
  // Try cache first for static assets
  const cachedResponse = await cache.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    // Fetch from network
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Cache static assets
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Static request failed:', error)
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/offline') || createOfflineResponse()
    }
    
    throw error
  }
}

// Background sync for deck updates
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag)
  
  if (event.tag === 'deck-update') {
    event.waitUntil(syncDeckUpdates())
  } else if (event.tag === 'collection-sync') {
    event.waitUntil(syncCollectionUpdates())
  }
})

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event)
  
  if (event.data) {
    const data = event.data.json()
    
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: data.data,
      actions: data.actions || []
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event)
  
  event.notification.close()
  
  const data = event.notification.data
  let url = '/'
  
  if (data && data.url) {
    url = data.url
  } else if (event.action) {
    // Handle action buttons
    switch (event.action) {
      case 'view-deck':
        url = `/decks/${data.deckId}`
        break
      case 'view-suggestions':
        url = `/decks/${data.deckId}/suggestions`
        break
      default:
        url = '/'
    }
  }
  
  event.waitUntil(
    clients.openWindow(url)
  )
})

// Utility functions
function isCardImageRequest(url) {
  return CARD_IMAGE_DOMAINS.some(domain => url.hostname.includes(domain))
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isDeckPageRequest(url) {
  return url.pathname.startsWith('/decks/') || 
         url.pathname.startsWith('/deckforge/') ||
         url.pathname.startsWith('/collection/')
}

function createOfflineResponse() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DeckForge - Offline</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
          color: #333;
        }
        .offline-container {
          text-align: center;
          max-width: 400px;
          padding: 2rem;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          margin-bottom: 1rem;
          color: #666;
        }
        p {
          margin-bottom: 2rem;
          line-height: 1.5;
        }
        .retry-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 1rem;
        }
        .retry-button:hover {
          background: #0056b3;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>You're Offline</h1>
        <p>
          You're currently offline, but you can still view your cached decks and collections.
          We'll sync your changes when you're back online.
        </p>
        <button class="retry-button" onclick="window.location.reload()">
          Try Again
        </button>
      </div>
      
      <script>
        // Auto-retry when online
        window.addEventListener('online', () => {
          window.location.reload()
        })
      </script>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  })
}

function createOfflineDeckResponse() {
  return new Response(JSON.stringify({
    error: 'offline',
    message: 'This deck is not available offline',
    cached: false
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'X-Served-From': 'offline'
    }
  })
}

async function syncDeckUpdates() {
  console.log('Syncing deck updates...')
  
  try {
    // Get pending deck updates from IndexedDB
    const pendingUpdates = await getPendingDeckUpdates()
    
    for (const update of pendingUpdates) {
      try {
        // Attempt to sync the update
        const response = await fetch('/api/trpc/deck.updateDeck', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(update)
        })
        
        if (response.ok) {
          // Remove from pending updates
          await removePendingDeckUpdate(update.id)
          console.log('Deck update synced:', update.id)
        }
      } catch (error) {
        console.log('Failed to sync deck update:', error)
      }
    }
  } catch (error) {
    console.log('Error syncing deck updates:', error)
  }
}

async function syncCollectionUpdates() {
  console.log('Syncing collection updates...')
  
  try {
    // Similar to deck updates but for collection changes
    const pendingUpdates = await getPendingCollectionUpdates()
    
    for (const update of pendingUpdates) {
      try {
        const response = await fetch('/api/trpc/collection.updateCollection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(update)
        })
        
        if (response.ok) {
          await removePendingCollectionUpdate(update.id)
          console.log('Collection update synced:', update.id)
        }
      } catch (error) {
        console.log('Failed to sync collection update:', error)
      }
    }
  } catch (error) {
    console.log('Error syncing collection updates:', error)
  }
}

// IndexedDB helpers for offline storage
async function getPendingDeckUpdates() {
  // This would use IndexedDB to get pending updates
  // For now, return empty array
  return []
}

async function removePendingDeckUpdate(id) {
  // This would remove the update from IndexedDB
  console.log('Removing pending deck update:', id)
}

async function getPendingCollectionUpdates() {
  // This would use IndexedDB to get pending collection updates
  return []
}

async function removePendingCollectionUpdate(id) {
  // This would remove the collection update from IndexedDB
  console.log('Removing pending collection update:', id)
}

// Periodic cache cleanup
setInterval(async () => {
  try {
    // Clean up old card image cache entries
    const cardImageCache = await caches.open(CARD_IMAGE_CACHE)
    const requests = await cardImageCache.keys()
    
    // Remove entries older than 7 days
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    
    for (const request of requests) {
      const response = await cardImageCache.match(request)
      if (response) {
        const dateHeader = response.headers.get('date')
        if (dateHeader && new Date(dateHeader).getTime() < oneWeekAgo) {
          await cardImageCache.delete(request)
        }
      }
    }
    
    console.log('Cache cleanup completed')
  } catch (error) {
    console.log('Cache cleanup failed:', error)
  }
}, 24 * 60 * 60 * 1000) // Run daily