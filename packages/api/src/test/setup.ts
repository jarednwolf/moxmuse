import { vi } from 'vitest'

process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.SENTRY_DSN = process.env.SENTRY_DSN || ''
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

vi.mock('@sentry/node', () => {
	const noOp = () => {}
	return {
		init: vi.fn(),
		Integrations: {
			Http: vi.fn().mockImplementation(() => ({})),
			Express: vi.fn().mockImplementation(() => ({})),
		},
		withScope: vi.fn((cb: any) => cb({ setUser: noOp, setTag: noOp, setContext: noOp })),
		captureException: vi.fn(() => 'test-error-id'),
		captureMessage: vi.fn(() => 'test-message-id'),
		addBreadcrumb: vi.fn(),
		setUser: vi.fn(),
		startTransaction: vi.fn(() => ({ finish: noOp, setTag: noOp, setData: noOp, setStatus: noOp })),
		flush: vi.fn(async () => true),
	}
})

vi.mock('@sentry/profiling-node', () => ({ ProfilingIntegration: vi.fn(() => ({})) }))

if (!(global as any).fetch) {
	;(global as any).fetch = async () =>
		({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) } as any)
}

vi.mock('../services/core/performance-monitor', async (importOriginal) => {
	const actual = await importOriginal()
	const noOpTrack = async <T>(_: string, fn: () => Promise<T>) => await fn()
	return {
		...actual,
		performanceMonitor: {
			startTimer: vi.fn(() => ({ end: vi.fn(), stop: vi.fn() })),
			recordMetric: vi.fn(),
			trackOperation: vi.fn(noOpTrack as any),
		},
	}
})

// Env-driven partial mocks for crypto/bcrypt failures
vi.mock('crypto', async (importOriginal) => {
	const actual: any = await importOriginal()
	const mocked = {
		...actual,
		randomBytes: (...args: any[]) => {
			if (process.env.TEST_FORCE_CRYPTO_FAIL === '1') throw new Error('Forced crypto failure')
			return actual.randomBytes(...args)
		},
		createCipheriv: (...args: any[]) => {
			if (process.env.TEST_FORCE_CRYPTO_FAIL === '1') throw new Error('Forced crypto failure')
			return actual.createCipheriv(...args)
		},
	}
	return { ...mocked, default: mocked }
})

vi.mock('bcryptjs', async (importOriginal) => {
	const actual: any = await importOriginal()
	const mocked = {
		...actual,
		hash: (...args: any[]) => {
			if (process.env.TEST_FORCE_BCRYPT_FAIL === '1') return Promise.reject(new Error('Forced bcrypt failure'))
			return actual.hash(...args)
		},
	}
	return { ...mocked, default: mocked }
})

// Note: Do not globally mock 'cron' here; individual tests will control cron spies

// Shared prisma-like mock for DB modules
const prismaLike: any = {
	$use: vi.fn(),
	$transaction: vi.fn(async (fn: any) => (typeof fn === 'function' ? await fn(prismaLike) : null)),
	$queryRaw: vi.fn(),
	$executeRaw: vi.fn(),
	// Common models used across tests
	enhancedCardData: {
		findUnique: vi.fn(),
		findMany: vi.fn(),
		update: vi.fn(),
		count: vi.fn(),
	},
	enhancedCard: {
		findUnique: vi.fn(),
	},
	aIAnalysisCache: {
		create: vi.fn(),
		findFirst: vi.fn(),
		count: vi.fn(),
	},
	suggestionFeedback: {
		create: vi.fn(),
		groupBy: vi.fn(),
	},
	searchAnalytics: {
		create: vi.fn(),
	},
	searchHistory: {
		create: vi.fn(),
		findMany: vi.fn(),
	},
	savedSearch: {
		create: vi.fn(),
		findMany: vi.fn(),
	},
	cardClick: {
		create: vi.fn(),
	},
	user: {
		findUnique: vi.fn(),
	},
	performanceMetric: {
		create: vi.fn(),
	},
}

// Safe fallback mocks for both module paths to share the same object reference
vi.mock('@moxmuse/db', () => {
	const PrismaClient = vi.fn(() => prismaLike)
	return {
		prisma: prismaLike,
		db: prismaLike,
		PrismaClient,
		default: { PrismaClient, prisma: prismaLike, db: prismaLike },
	}
})

vi.mock('@repo/db', () => {
	return {
		db: prismaLike,
		default: { db: prismaLike },
	}
})
