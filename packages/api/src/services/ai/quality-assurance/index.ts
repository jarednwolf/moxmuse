// AI Quality Assurance Module
// Comprehensive quality validation and continuous improvement for AI-generated decks

export { 
  AIQualityAssuranceService,
  aiQualityAssuranceService,
  type QualityMetrics,
  type QualityTestResult,
  type FeedbackData,
  QualityMetricsSchema,
  QualityTestResultSchema,
  FeedbackDataSchema
} from './AIQualityAssuranceService'

export {
  AutomatedTestingService,
  automatedTestingService,
  type TestSuite,
  type TestExecutionResult,
  type TestSuiteResult,
  TestSuiteSchema,
  TestExecutionResultSchema,
  TestSuiteResultSchema
} from './AutomatedTestingService'

export {
  BudgetComplianceService,
  budgetComplianceService,
  type BudgetAnalysis,
  type BudgetAdjustmentRequest,
  type BudgetAdjustmentResult,
  BudgetAnalysisSchema,
  BudgetAdjustmentRequestSchema,
  BudgetAdjustmentResultSchema
} from './BudgetComplianceService'

export {
  PowerLevelAssessmentService,
  powerLevelAssessmentService,
  type PowerLevelAssessment,
  type PowerLevelFactor,
  type PowerLevelValidation,
  PowerLevelAssessmentSchema,
  PowerLevelFactorSchema,
  PowerLevelValidationSchema
} from './PowerLevelAssessmentService'

export {
  FeedbackLoopService,
  feedbackLoopService,
  type ImprovementMetric,
  type LearningInsight,
  type ModelPerformance,
  type FeedbackAnalysis,
  ImprovementMetricSchema,
  LearningInsightSchema,
  ModelPerformanceSchema,
  FeedbackAnalysisSchema
} from './FeedbackLoopService'

// Re-export from existing deck validator for compatibility
export {
  aiValidationEngine,
  type ValidationResult,
  type DeckValidationRequest,
  ValidationResultSchema,
  DeckValidationRequestSchema
} from '../deck-validator'