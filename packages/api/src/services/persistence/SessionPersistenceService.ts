import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { AutoSaveService } from './AutoSaveService'

// Types for session persistence
export interface ConsultationSession {
  id: string
  userId: string
  currentStep: number
  totalSteps: number
  responses: Record<string, any>
  preferences: {
    commander?: string
    strategy?: string
    budget?: number
    powerLevel?: number
    themes?: string[]
    colors?: string[]
    avoidStrategies?: string[]
    avoidCards?: string[]
    petCards?: string[]
  }
  status: 'in_progress' | 'completed' | 'abandoned' | 'paused'
  version: number
  checksum: string
  autoSaveEnabled: boolean
  lastAutoSave?: Date
  createdAt: Date
  updatedAt: Date
}

export interface SessionResumptionData {
  session: ConsultationSession
  nextStep: number
  completionPercentage: number
  canResume: boolean
  resumeReasons: string[]
  blockers: string[]
}

export interface SessionSnapshot {
  sessionId: string
  step: number
  stepData: any
  timestamp: Date
  isCheckpoint: boolean
}

// Validation schemas
const SessionResponseSchema = z.record(z.any())
const SessionPreferencesSchema = z.object({
  commander: z.string().optional(),
  strategy: z.string().optional(),
  budget: z.number().optional(),
  powerLevel: z.number().min(1).max(10).optional(),
  themes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  avoidStrategies: z.array(z.string()).optional(),
  avoidCards: z.array(z.string()).optional(),
  petCards: z.array(z.string()).optional(),
})

export class SessionPersistenceService {
  private prisma: PrismaClient
  private autoSaveService: AutoSaveService
  private sessionSnapshots: Map<string, SessionSnapshot[]> = new Map()

  constructor(prisma: PrismaClient, autoSaveService: AutoSaveService) {
    this.prisma = prisma
    this.autoSaveService = autoSaveService
  }

  /**
   * Create a new consultation session
   */
  async createSession(
    userId: string,
    totalSteps: number = 10,
    initialPreferences: any = {}
  ): Promise<ConsultationSession> {
    const sessionId = `session-${userId}-${Date.now()}`
    
    const sessionData = {
      id: sessionId,
      userId,
      currentStep: 0,
      totalSteps,
      responses: {},
      preferences: SessionPreferencesSchema.parse(initialPreferences),
      status: 'in_progress' as const,
      version: 1,
      checksum: '',
      autoSaveEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Calculate initial checksum
    sessionData.checksum = this.calculateChecksum(sessionData)

    // Save to database
    const savedSession = await this.prisma.consultationSession.create({
      data: {
        id: sessionData.id,
        userId: sessionData.userId,
        currentStep: sessionData.currentStep,
        totalSteps: sessionData.totalSteps,
        responses: sessionData.responses,
        preferences: sessionData.preferences,
        status: sessionData.status,
        version: sessionData.version,
        checksum: sessionData.checksum,
        autoSaveEnabled: sessionData.autoSaveEnabled,
      }
    })

    // Initialize snapshots
    this.sessionSnapshots.set(sessionId, [])

    // Create initial snapshot
    await this.createSnapshot(sessionId, 0, sessionData, true)

    return this.mapPrismaToSession(savedSession)
  }

  /**
   * Update session with new step data
   */
  async updateSession(
    sessionId: string,
    stepNumber: number,
    stepData: any,
    preferences?: any
  ): Promise<ConsultationSession> {
    const existingSession = await this.getSession(sessionId)
    if (!existingSession) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Update responses
    const updatedResponses = {
      ...existingSession.responses,
      [stepNumber]: stepData
    }

    // Update preferences if provided
    const updatedPreferences = preferences 
      ? { ...existingSession.preferences, ...preferences }
      : existingSession.preferences

    const updatedSession = {
      ...existingSession,
      currentStep: stepNumber,
      responses: updatedResponses,
      preferences: updatedPreferences,
      version: existingSession.version + 1,
      updatedAt: new Date(),
    }

    // Calculate new checksum
    updatedSession.checksum = this.calculateChecksum(updatedSession)

    // Create snapshot for this step
    await this.createSnapshot(sessionId, stepNumber, stepData, false)

    // Schedule auto-save if enabled
    if (existingSession.autoSaveEnabled) {
      await this.autoSaveService.scheduleSessionSave(
        existingSession.userId,
        sessionId,
        updatedSession
      )
    }

    return updatedSession
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ConsultationSession | null> {
    const session = await this.prisma.consultationSession.findUnique({
      where: { id: sessionId }
    })

    return session ? this.mapPrismaToSession(session) : null
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string,
    status?: ConsultationSession['status']
  ): Promise<ConsultationSession[]> {
    const sessions = await this.prisma.consultationSession.findMany({
      where: {
        userId,
        ...(status && { status })
      },
      orderBy: { updatedAt: 'desc' }
    })

    return sessions.map(this.mapPrismaToSession)
  }

  /**
   * Get resumable sessions for a user
   */
  async getResumableSessions(userId: string): Promise<SessionResumptionData[]> {
    const sessions = await this.prisma.consultationSession.findMany({
      where: {
        userId,
        status: { in: ['in_progress', 'paused'] }
      },
      orderBy: { updatedAt: 'desc' }
    })

    const resumptionData = await Promise.all(
      sessions.map(async (session) => {
        const mappedSession = this.mapPrismaToSession(session)
        return this.analyzeResumability(mappedSession)
      })
    )

    return resumptionData.filter(data => data.canResume)
  }

  /**
   * Resume a session
   */
  async resumeSession(sessionId: string): Promise<SessionResumptionData> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Update status to in_progress if it was paused
    if (session.status === 'paused') {
      await this.updateSessionStatus(sessionId, 'in_progress')
      session.status = 'in_progress'
    }

    return this.analyzeResumability(session)
  }

  /**
   * Pause a session
   */
  async pauseSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'paused')
    
    // Force save current state
    await this.autoSaveService.forceSave('consultation-session', sessionId)
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string, finalData?: any): Promise<void> {
    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Update with final data if provided
    if (finalData) {
      await this.updateSession(sessionId, session.totalSteps, finalData)
    }

    // Mark as completed
    await this.updateSessionStatus(sessionId, 'completed')
    
    // Force save final state
    await this.autoSaveService.forceSave('consultation-session', sessionId)

    // Create final checkpoint
    await this.createSnapshot(sessionId, session.totalSteps, finalData || {}, true)
  }

  /**
   * Abandon a session
   */
  async abandonSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'abandoned')
  }

  /**
   * Get session history/snapshots
   */
  async getSessionHistory(sessionId: string): Promise<SessionSnapshot[]> {
    const snapshots = this.sessionSnapshots.get(sessionId) || []
    
    // Also load from database if not in memory
    if (snapshots.length === 0) {
      const dbSnapshots = await this.prisma.sessionSnapshot.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' }
      })
      
      const mappedSnapshots = dbSnapshots.map(snapshot => ({
        sessionId: snapshot.sessionId,
        step: snapshot.step,
        stepData: snapshot.stepData,
        timestamp: snapshot.timestamp,
        isCheckpoint: snapshot.isCheckpoint,
      }))
      
      this.sessionSnapshots.set(sessionId, mappedSnapshots)
      return mappedSnapshots
    }
    
    return snapshots
  }

  /**
   * Restore session to a specific step
   */
  async restoreToStep(sessionId: string, stepNumber: number): Promise<ConsultationSession> {
    const snapshots = await this.getSessionHistory(sessionId)
    const targetSnapshot = snapshots.find(s => s.step === stepNumber)
    
    if (!targetSnapshot) {
      throw new Error(`No snapshot found for step ${stepNumber}`)
    }

    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Restore session to target step
    const restoredSession = {
      ...session,
      currentStep: stepNumber,
      responses: this.buildResponsesUpToStep(snapshots, stepNumber),
      version: session.version + 1,
      updatedAt: new Date(),
    }

    restoredSession.checksum = this.calculateChecksum(restoredSession)

    // Save restored state
    await this.prisma.consultationSession.update({
      where: { id: sessionId },
      data: {
        currentStep: restoredSession.currentStep,
        responses: restoredSession.responses,
        version: restoredSession.version,
        checksum: restoredSession.checksum,
        updatedAt: restoredSession.updatedAt,
      }
    })

    return restoredSession
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await this.prisma.consultationSession.deleteMany({
      where: {
        status: { in: ['abandoned', 'completed'] },
        updatedAt: { lt: cutoffDate }
      }
    })

    return result.count
  }

  /**
   * Private helper methods
   */
  private async updateSessionStatus(
    sessionId: string, 
    status: ConsultationSession['status']
  ): Promise<void> {
    await this.prisma.consultationSession.update({
      where: { id: sessionId },
      data: { 
        status,
        updatedAt: new Date()
      }
    })
  }

  private async createSnapshot(
    sessionId: string,
    step: number,
    stepData: any,
    isCheckpoint: boolean
  ): Promise<void> {
    const snapshot: SessionSnapshot = {
      sessionId,
      step,
      stepData,
      timestamp: new Date(),
      isCheckpoint,
    }

    // Add to memory cache
    const snapshots = this.sessionSnapshots.get(sessionId) || []
    snapshots.push(snapshot)
    this.sessionSnapshots.set(sessionId, snapshots)

    // Save to database for persistence
    await this.prisma.sessionSnapshot.create({
      data: {
        sessionId: snapshot.sessionId,
        step: snapshot.step,
        stepData: snapshot.stepData,
        timestamp: snapshot.timestamp,
        isCheckpoint: snapshot.isCheckpoint,
      }
    })
  }

  private async analyzeResumability(session: ConsultationSession): Promise<SessionResumptionData> {
    const completionPercentage = (session.currentStep / session.totalSteps) * 100
    const nextStep = Math.min(session.currentStep + 1, session.totalSteps)
    
    const resumeReasons: string[] = []
    const blockers: string[] = []

    // Check if session can be resumed
    if (session.status === 'completed') {
      blockers.push('Session is already completed')
    } else if (session.status === 'abandoned') {
      blockers.push('Session was abandoned')
    } else {
      resumeReasons.push('Session is in progress')
    }

    // Check session age
    const daysSinceUpdate = Math.floor(
      (Date.now() - session.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceUpdate > 7) {
      resumeReasons.push('Session is recent enough to resume')
    } else if (daysSinceUpdate > 30) {
      blockers.push('Session is too old (>30 days)')
    }

    // Check if there's meaningful progress
    if (session.currentStep > 0) {
      resumeReasons.push(`Progress made: ${completionPercentage.toFixed(1)}% complete`)
    }

    const canResume = blockers.length === 0

    return {
      session,
      nextStep,
      completionPercentage,
      canResume,
      resumeReasons,
      blockers,
    }
  }

  private buildResponsesUpToStep(snapshots: SessionSnapshot[], targetStep: number): Record<string, any> {
    const responses: Record<string, any> = {}
    
    snapshots
      .filter(s => s.step <= targetStep)
      .forEach(snapshot => {
        responses[snapshot.step] = snapshot.stepData
      })
    
    return responses
  }

  private mapPrismaToSession(prismaSession: any): ConsultationSession {
    return {
      id: prismaSession.id,
      userId: prismaSession.userId,
      currentStep: prismaSession.currentStep,
      totalSteps: prismaSession.totalSteps,
      responses: prismaSession.responses,
      preferences: prismaSession.preferences,
      status: prismaSession.status,
      version: prismaSession.version,
      checksum: prismaSession.checksum,
      autoSaveEnabled: prismaSession.autoSaveEnabled,
      lastAutoSave: prismaSession.lastAutoSave,
      createdAt: prismaSession.createdAt,
      updatedAt: prismaSession.updatedAt,
    }
  }

  private calculateChecksum(data: any): string {
    const crypto = require('crypto')
    const dataString = JSON.stringify(data, Object.keys(data).sort())
    return crypto.createHash('sha256').update(dataString).digest('hex')
  }
}