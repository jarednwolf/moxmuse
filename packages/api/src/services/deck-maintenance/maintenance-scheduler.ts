import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'
import { AutomaticAnalysisService } from './automatic-analysis'
import { SetMonitorService } from './set-monitor'
import { ProactiveSuggestionsService } from './proactive-suggestions'
import { MultiDeckOptimizerService } from './multi-deck-optimizer'

interface ScheduledTask {
  id: string
  type: 'deck_analysis' | 'portfolio_optimization' | 'set_monitoring' | 'price_updates' | 'meta_analysis'
  userId?: string
  deckId?: string
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'
  nextRun: Date
  lastRun?: Date
  isActive: boolean
  configuration: Record<string, any>
  retryCount: number
  maxRetries: number
  createdAt: Date
  updatedAt: Date
}

interface MaintenanceJob {
  id: string
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: Date
  completedAt?: Date
  error?: string
  result?: any
  processingTime?: number
}

interface SchedulerConfiguration {
  maxConcurrentJobs: number
  jobTimeout: number
  retryDelay: number
  enabledTaskTypes: string[]
  maintenanceWindow: {
    start: string // HH:MM format
    end: string   // HH:MM format
    timezone: string
  }
}

interface MaintenanceReport {
  period: 'daily' | 'weekly' | 'monthly'
  startDate: Date
  endDate: Date
  tasksExecuted: number
  tasksSuccessful: number
  tasksFailed: number
  averageProcessingTime: number
  taskBreakdown: {
    type: string
    count: number
    successRate: number
    avgProcessingTime: number
  }[]
  errors: {
    taskType: string
    error: string
    count: number
  }[]
  recommendations: string[]
}

export class MaintenanceSchedulerService {
  private readonly DEFAULT_CONFIG: SchedulerConfiguration = {
    maxConcurrentJobs: 5,
    jobTimeout: 300000, // 5 minutes
    retryDelay: 60000,  // 1 minute
    enabledTaskTypes: ['deck_analysis', 'portfolio_optimization', 'set_monitoring', 'price_updates'],
    maintenanceWindow: {
      start: '02:00',
      end: '06:00',
      timezone: 'UTC'
    }
  }

  private runningJobs = new Map<string, MaintenanceJob>()
  private isSchedulerRunning = false

  constructor(
    private prisma: PrismaClient,
    private analysisService: AutomaticAnalysisService,
    private setMonitor: SetMonitorService,
    private suggestionsService: ProactiveSuggestionsService,
    private optimizerService: MultiDeckOptimizerService
  ) {}

  /**
   * Start the maintenance scheduler
   */
  async startScheduler(): Promise<void> {
    if (this.isSchedulerRunning) {
      console.log('Maintenance scheduler is already running')
      return
    }

    this.isSchedulerRunning = true
    console.log('Starting maintenance scheduler...')

    // Initialize default scheduled tasks
    await this.initializeDefaultTasks()

    // Start the main scheduler loop
    this.scheduleNextRun()
  }

  /**
   * Stop the maintenance scheduler
   */
  async stopScheduler(): Promise<void> {
    this.isSchedulerRunning = false
    console.log('Stopping maintenance scheduler...')

    // Wait for running jobs to complete or timeout
    const runningJobIds = Array.from(this.runningJobs.keys())
    if (runningJobIds.length > 0) {
      console.log(`Waiting for ${runningJobIds.length} running jobs to complete...`)
      
      // Give jobs 30 seconds to complete gracefully
      await new Promise(resolve => setTimeout(resolve, 30000))
      
      // Force stop any remaining jobs
      for (const jobId of this.runningJobs.keys()) {
        await this.stopJob(jobId, 'Scheduler shutdown')
      }
    }

    console.log('Maintenance scheduler stopped')
  }

  /**
   * Schedule a new maintenance task
   */
  async scheduleTask(
    type: ScheduledTask['type'],
    frequency: ScheduledTask['frequency'],
    configuration: Record<string, any> = {},
    userId?: string,
    deckId?: string
  ): Promise<ScheduledTask> {
    try {
      const nextRun = this.calculateNextRun(frequency)
      
      const task = await this.prisma.scheduledTask.create({
        data: {
          type,
          userId,
          deckId,
          frequency,
          nextRun,
          isActive: true,
          configuration,
          retryCount: 0,
          maxRetries: 3
        }
      })

      return this.mapTaskFromDb(task)
    } catch (error) {
      console.error('Error scheduling task:', error)
      throw error
    }
  }

  /**
   * Update an existing scheduled task
   */
  async updateTask(
    taskId: string,
    updates: Partial<Pick<ScheduledTask, 'frequency' | 'isActive' | 'configuration'>>
  ): Promise<ScheduledTask> {
    try {
      const updateData: any = { ...updates }
      
      // Recalculate next run if frequency changed
      if (updates.frequency) {
        updateData.nextRun = this.calculateNextRun(updates.frequency)
      }

      const task = await this.prisma.scheduledTask.update({
        where: { id: taskId },
        data: updateData
      })

      return this.mapTaskFromDb(task)
    } catch (error) {
      console.error('Error updating task:', error)
      throw error
    }
  }

  /**
   * Delete a scheduled task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.prisma.scheduledTask.delete({
        where: { id: taskId }
      })
    } catch (error) {
      console.error('Error deleting task:', error)
      throw error
    }
  }

  /**
   * Get scheduled tasks for a user
   */
  async getUserTasks(userId: string): Promise<ScheduledTask[]> {
    try {
      const tasks = await this.prisma.scheduledTask.findMany({
        where: {
          OR: [
            { userId },
            { userId: null } // Global tasks
          ]
        },
        orderBy: { nextRun: 'asc' }
      })

      return tasks.map(this.mapTaskFromDb)
    } catch (error) {
      console.error('Error getting user tasks:', error)
      return []
    }
  }

  /**
   * Main scheduler loop
   */
  private async scheduleNextRun(): Promise<void> {
    if (!this.isSchedulerRunning) return

    try {
      await this.processPendingTasks()
    } catch (error) {
      console.error('Error in scheduler loop:', error)
    }

    // Schedule next run in 1 minute
    setTimeout(() => this.scheduleNextRun(), 60000)
  }

  /**
   * Process pending tasks
   */
  private async processPendingTasks(): Promise<void> {
    try {
      const config = await this.getSchedulerConfiguration()
      
      // Check if we're in maintenance window for heavy tasks
      const isMaintenanceWindow = this.isInMaintenanceWindow(config.maintenanceWindow)
      
      // Get pending tasks
      const pendingTasks = await this.prisma.scheduledTask.findMany({
        where: {
          isActive: true,
          nextRun: {
            lte: new Date()
          }
        },
        orderBy: [
          { type: 'asc' }, // Process by type priority
          { nextRun: 'asc' }
        ]
      })

      // Filter tasks based on maintenance window
      const tasksToProcess = pendingTasks.filter(task => {
        if (this.isHeavyTask(task.type) && !isMaintenanceWindow) {
          return false
        }
        return config.enabledTaskTypes.includes(task.type)
      })

      // Limit concurrent jobs
      const availableSlots = config.maxConcurrentJobs - this.runningJobs.size
      const tasksToRun = tasksToProcess.slice(0, availableSlots)

      // Process tasks
      for (const task of tasksToRun) {
        await this.executeTask(this.mapTaskFromDb(task))
      }
    } catch (error) {
      console.error('Error processing pending tasks:', error)
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const jobId = `${task.id}_${Date.now()}`
    
    const job: MaintenanceJob = {
      id: jobId,
      taskId: task.id,
      status: 'pending',
      startedAt: new Date()
    }

    this.runningJobs.set(jobId, job)

    try {
      // Update job status
      job.status = 'running'
      
      // Execute the task based on type
      const result = await this.executeTaskByType(task)
      
      // Mark job as completed
      job.status = 'completed'
      job.completedAt = new Date()
      job.result = result
      job.processingTime = job.completedAt.getTime() - job.startedAt!.getTime()

      // Update task for next run
      await this.updateTaskAfterExecution(task, true)

      console.log(`Task ${task.type} (${task.id}) completed successfully`)
    } catch (error) {
      // Mark job as failed
      job.status = 'failed'
      job.completedAt = new Date()
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.processingTime = job.completedAt.getTime() - job.startedAt!.getTime()

      // Handle task failure
      await this.handleTaskFailure(task, error)

      console.error(`Task ${task.type} (${task.id}) failed:`, error)
    } finally {
      // Store job result
      await this.storeJobResult(job)
      
      // Remove from running jobs
      this.runningJobs.delete(jobId)
    }
  }

  /**
   * Execute task based on its type
   */
  private async executeTaskByType(task: ScheduledTask): Promise<any> {
    switch (task.type) {
      case 'deck_analysis':
        return await this.executeDeckAnalysis(task)
      
      case 'portfolio_optimization':
        return await this.executePortfolioOptimization(task)
      
      case 'set_monitoring':
        return await this.executeSetMonitoring(task)
      
      case 'price_updates':
        return await this.executePriceUpdates(task)
      
      case 'meta_analysis':
        return await this.executeMetaAnalysis(task)
      
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }
  }

  /**
   * Task execution methods
   */
  private async executeDeckAnalysis(task: ScheduledTask): Promise<any> {
    if (task.deckId && task.userId) {
      return await this.suggestionsService.generateProactiveSuggestions(task.deckId, task.userId)
    } else if (task.userId) {
      // Analyze all user decks
      const decks = await this.prisma.deck.findMany({
        where: { userId: task.userId },
        select: { id: true }
      })
      
      const results = []
      for (const deck of decks) {
        const suggestions = await this.suggestionsService.generateProactiveSuggestions(deck.id, task.userId)
        results.push({ deckId: deck.id, suggestions })
      }
      
      return results
    }
    
    throw new Error('Deck analysis task requires userId and optionally deckId')
  }

  private async executePortfolioOptimization(task: ScheduledTask): Promise<any> {
    if (!task.userId) {
      throw new Error('Portfolio optimization task requires userId')
    }
    
    return await this.optimizerService.optimizeUserDecks(task.userId)
  }

  private async executeSetMonitoring(task: ScheduledTask): Promise<any> {
    return await this.setMonitor.monitorNewSets()
  }

  private async executePriceUpdates(task: ScheduledTask): Promise<any> {
    // This would trigger price updates for all tracked cards
    // Implementation would depend on price service
    return { message: 'Price updates completed' }
  }

  private async executeMetaAnalysis(task: ScheduledTask): Promise<any> {
    // This would trigger meta analysis updates
    // Implementation would depend on meta service
    return { message: 'Meta analysis completed' }
  }

  /**
   * Helper methods
   */
  private async initializeDefaultTasks(): Promise<void> {
    try {
      // Check if default tasks already exist
      const existingTasks = await this.prisma.scheduledTask.count()
      if (existingTasks > 0) return

      // Create default global tasks
      const defaultTasks = [
        {
          type: 'set_monitoring' as const,
          frequency: 'daily' as const,
          configuration: { checkNewSets: true }
        },
        {
          type: 'price_updates' as const,
          frequency: 'hourly' as const,
          configuration: { updateAllPrices: true }
        },
        {
          type: 'meta_analysis' as const,
          frequency: 'daily' as const,
          configuration: { updateMetaData: true }
        }
      ]

      for (const taskData of defaultTasks) {
        await this.scheduleTask(
          taskData.type,
          taskData.frequency,
          taskData.configuration
        )
      }

      console.log('Default maintenance tasks initialized')
    } catch (error) {
      console.error('Error initializing default tasks:', error)
    }
  }

  private calculateNextRun(frequency: ScheduledTask['frequency']): Date {
    const now = new Date()
    
    switch (frequency) {
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000)
      
      case 'daily':
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(2, 0, 0, 0) // 2 AM
        return tomorrow
      
      case 'weekly':
        const nextWeek = new Date(now)
        nextWeek.setDate(nextWeek.getDate() + 7)
        nextWeek.setHours(2, 0, 0, 0) // 2 AM
        return nextWeek
      
      case 'monthly':
        const nextMonth = new Date(now)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setDate(1)
        nextMonth.setHours(2, 0, 0, 0) // 2 AM on 1st of month
        return nextMonth
      
      default:
        return new Date(now.getTime() + 60 * 60 * 1000) // Default to 1 hour
    }
  }

  private async updateTaskAfterExecution(task: ScheduledTask, success: boolean): Promise<void> {
    try {
      const updateData: any = {
        lastRun: new Date(),
        nextRun: this.calculateNextRun(task.frequency),
        retryCount: success ? 0 : task.retryCount + 1
      }

      // Disable task if max retries exceeded
      if (!success && task.retryCount >= task.maxRetries) {
        updateData.isActive = false
      }

      await this.prisma.scheduledTask.update({
        where: { id: task.id },
        data: updateData
      })
    } catch (error) {
      console.error('Error updating task after execution:', error)
    }
  }

  private async handleTaskFailure(task: ScheduledTask, error: any): Promise<void> {
    console.error(`Task ${task.type} (${task.id}) failed:`, error)
    
    // If retries are available, schedule retry
    if (task.retryCount < task.maxRetries) {
      const retryDelay = this.calculateRetryDelay(task.retryCount)
      const nextRun = new Date(Date.now() + retryDelay)
      
      await this.prisma.scheduledTask.update({
        where: { id: task.id },
        data: {
          nextRun,
          retryCount: task.retryCount + 1
        }
      })
    }
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 1min, 2min, 4min, etc.
    return Math.min(60000 * Math.pow(2, retryCount), 300000) // Max 5 minutes
  }

  private async storeJobResult(job: MaintenanceJob): Promise<void> {
    try {
      await this.prisma.maintenanceJob.create({
        data: {
          id: job.id,
          taskId: job.taskId,
          status: job.status,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          error: job.error,
          result: job.result,
          processingTime: job.processingTime
        }
      })
    } catch (error) {
      console.error('Error storing job result:', error)
    }
  }

  private async stopJob(jobId: string, reason: string): Promise<void> {
    const job = this.runningJobs.get(jobId)
    if (job) {
      job.status = 'failed'
      job.error = reason
      job.completedAt = new Date()
      
      await this.storeJobResult(job)
      this.runningJobs.delete(jobId)
    }
  }

  private async getSchedulerConfiguration(): Promise<SchedulerConfiguration> {
    // This would be stored in database or config file
    // For now, return default configuration
    return this.DEFAULT_CONFIG
  }

  private isInMaintenanceWindow(window: SchedulerConfiguration['maintenanceWindow']): boolean {
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
    
    return currentTime >= window.start && currentTime <= window.end
  }

  private isHeavyTask(taskType: string): boolean {
    const heavyTasks = ['portfolio_optimization', 'meta_analysis']
    return heavyTasks.includes(taskType)
  }

  private mapTaskFromDb(dbTask: any): ScheduledTask {
    return {
      id: dbTask.id,
      type: dbTask.type,
      userId: dbTask.userId,
      deckId: dbTask.deckId,
      frequency: dbTask.frequency,
      nextRun: dbTask.nextRun,
      lastRun: dbTask.lastRun,
      isActive: dbTask.isActive,
      configuration: dbTask.configuration || {},
      retryCount: dbTask.retryCount || 0,
      maxRetries: dbTask.maxRetries || 3,
      createdAt: dbTask.createdAt,
      updatedAt: dbTask.updatedAt
    }
  }

  /**
   * Public methods for monitoring and reporting
   */
  async getMaintenanceReport(
    period: 'daily' | 'weekly' | 'monthly',
    startDate?: Date,
    endDate?: Date
  ): Promise<MaintenanceReport> {
    try {
      if (!startDate || !endDate) {
        const now = new Date()
        endDate = now
        
        switch (period) {
          case 'daily':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            break
          case 'weekly':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'monthly':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
        }
      }

      // Get job statistics
      const jobs = await this.prisma.maintenanceJob.findMany({
        where: {
          startedAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          task: true
        }
      })

      const tasksExecuted = jobs.length
      const tasksSuccessful = jobs.filter(j => j.status === 'completed').length
      const tasksFailed = jobs.filter(j => j.status === 'failed').length
      
      const averageProcessingTime = jobs.length > 0
        ? jobs.reduce((sum, j) => sum + (j.processingTime || 0), 0) / jobs.length
        : 0

      // Task breakdown
      const taskTypes = new Map<string, { count: number; successful: number; totalTime: number }>()
      
      for (const job of jobs) {
        const type = job.task.type
        const existing = taskTypes.get(type) || { count: 0, successful: 0, totalTime: 0 }
        
        existing.count++
        if (job.status === 'completed') existing.successful++
        existing.totalTime += job.processingTime || 0
        
        taskTypes.set(type, existing)
      }

      const taskBreakdown = Array.from(taskTypes.entries()).map(([type, stats]) => ({
        type,
        count: stats.count,
        successRate: stats.count > 0 ? stats.successful / stats.count : 0,
        avgProcessingTime: stats.count > 0 ? stats.totalTime / stats.count : 0
      }))

      // Error analysis
      const errorMap = new Map<string, { error: string; count: number }>()
      
      for (const job of jobs.filter(j => j.status === 'failed')) {
        const key = `${job.task.type}:${job.error || 'Unknown error'}`
        const existing = errorMap.get(key) || { error: job.error || 'Unknown error', count: 0 }
        existing.count++
        errorMap.set(key, existing)
      }

      const errors = Array.from(errorMap.entries()).map(([key, data]) => ({
        taskType: key.split(':')[0],
        error: data.error,
        count: data.count
      }))

      // Generate recommendations
      const recommendations = this.generateRecommendations(taskBreakdown, errors)

      return {
        period,
        startDate,
        endDate,
        tasksExecuted,
        tasksSuccessful,
        tasksFailed,
        averageProcessingTime,
        taskBreakdown,
        errors,
        recommendations
      }
    } catch (error) {
      console.error('Error generating maintenance report:', error)
      throw error
    }
  }

  private generateRecommendations(
    taskBreakdown: MaintenanceReport['taskBreakdown'],
    errors: MaintenanceReport['errors']
  ): string[] {
    const recommendations: string[] = []

    // Check for low success rates
    const lowSuccessRateTasks = taskBreakdown.filter(t => t.successRate < 0.8)
    if (lowSuccessRateTasks.length > 0) {
      recommendations.push(`Review tasks with low success rates: ${lowSuccessRateTasks.map(t => t.type).join(', ')}`)
    }

    // Check for slow tasks
    const slowTasks = taskBreakdown.filter(t => t.avgProcessingTime > 60000) // > 1 minute
    if (slowTasks.length > 0) {
      recommendations.push(`Optimize slow-running tasks: ${slowTasks.map(t => t.type).join(', ')}`)
    }

    // Check for frequent errors
    const frequentErrors = errors.filter(e => e.count > 5)
    if (frequentErrors.length > 0) {
      recommendations.push(`Address frequent errors in: ${frequentErrors.map(e => e.taskType).join(', ')}`)
    }

    if (recommendations.length === 0) {
      recommendations.push('All maintenance tasks are running smoothly')
    }

    return recommendations
  }

  async getRunningJobs(): Promise<MaintenanceJob[]> {
    return Array.from(this.runningJobs.values())
  }

  async getSchedulerStatus(): Promise<{
    isRunning: boolean
    runningJobs: number
    nextTaskRun?: Date
  }> {
    const nextTask = await this.prisma.scheduledTask.findFirst({
      where: {
        isActive: true,
        nextRun: {
          gt: new Date()
        }
      },
      orderBy: { nextRun: 'asc' }
    })

    return {
      isRunning: this.isSchedulerRunning,
      runningJobs: this.runningJobs.size,
      nextTaskRun: nextTask?.nextRun
    }
  }
}