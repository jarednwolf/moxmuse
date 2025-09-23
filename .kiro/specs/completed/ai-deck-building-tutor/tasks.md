# AI Deck Building Tutor Implementation Plan

- [x] 1. Database Schema and Models Setup
  - Create generated_decks table with strategy context and consultation data fields
  - Add generated_deck_cards table with categorization and reasoning metadata
  - Implement deck_analysis table for caching statistics and synergies
  - Create consultation_sessions table for tracking wizard progress
  - Add database migrations and seed data for testing
  - _Requirements: 1.1, 2.1, 5.1, 12.1_

- [x] 2. Enhanced Data Models and Types
  - Define ConsultationData interface with comprehensive preference structure
  - Create GeneratedDeck and GeneratedDeckCard types with analysis metadata
  - Implement DeckStatistics interfaces for mana curve and distributions
  - Add CardSynergy and StrategyAnalysis type definitions
  - Create validation schemas using Zod for all new data structures
  - _Requirements: 2.2, 5.2, 6.1, 7.1_

- [x] 3. Entry Point Selector Component
  - Build EntryPointSelector component with visual deck building and chat options
  - Create DeckBuildingOption card with compelling description and preview
  - Implement CardRecommendationOption that routes to existing chat interface
  - Add responsive design and hover effects for better user experience
  - Write unit tests for component rendering and interaction handling
  - _Requirements: 1.1, 1.2, 1.5, 11.1_

- [x] 4. Deck Building Wizard Framework
  - Create WizardContainer component with progress tracking and navigation
  - Implement WizardStep base component with consistent styling and validation
  - Build WizardProgress component showing current step and completion status
  - Add step navigation logic with validation and data persistence
  - Create wizard state management using React hooks or context
  - _Requirements: 2.1, 2.2, 2.4, 11.1, 12.1_

- [x] 5. Wizard Step Components
  - Implement CommanderStep for known/unknown commander selection
  - Create StrategyStep for deck archetype and theme selection
  - Build BudgetStep with price range slider and collection toggle
  - Add PowerLevelStep with bracket selection and explanations
  - Implement WinConditionsStep for primary and secondary win condition choices
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 6. Advanced Wizard Steps
  - Create InteractionStep for removal and counterspell preferences
  - Build RestrictionsStep for avoided strategies and banned cards
  - Implement ComplexityStep for deck complexity and decision-making preferences
  - Add SummaryStep showing all collected preferences before generation
  - Write validation logic and error handling for each step
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 7. Enhanced OpenAI Service for Deck Generation
  - Extend openaiService with generateCompleteDeck method for full 100-card decks
  - Create buildDeckGenerationPrompt function using consultation data
  - Implement parseDeckGenerationResponse to extract categorized card lists
  - Add analyzeDeckSynergies method for identifying card interactions
  - Create suggestDeckStrategy method for generating strategy descriptions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.2_

- [x] 8. Commander Selection System
  - Build CommanderSelection component with grid layout for 5 commanders
  - Create CommanderCard component showing image, name, and reasoning
  - Implement CommanderGrid with loading states and selection handling
  - Add "Request More Options" functionality for different commander suggestions
  - Create manual commander entry with search and validation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1_

- [x] 9. Deck Generation Engine
  - Create DeckGenerationEngine component with progress tracking
  - Implement GenerationProgress component with phase descriptions and progress bar
  - Build assembleDeck function to process AI recommendations into structured deck
  - Add enhanceDeckWithAnalysis function for statistics and synergy calculation
  - Create error handling and retry logic for failed generation attempts
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 10. Enhanced tRPC API Endpoints
  - Add generateFullDeck mutation to tutor router for complete deck creation
  - Implement analyzeDeck query for calculating deck statistics and synergies
  - Create suggestDeckImprovements mutation for deck optimization suggestions
  - Add exportDeck mutation supporting multiple export formats
  - Implement saveConsultationSession for preserving wizard progress
  - _Requirements: 4.1, 4.2, 9.1, 10.1, 12.2_

- [x] 11. Deck Editor Layout and Structure
  - Create DeckEditor main component with sidebar and modal layout
  - Build DeckHeader with save, export, and view mode controls
  - Implement DeckCardList with category grouping and filtering
  - Add DeckStatisticsSidebar with interactive charts and analysis
  - Create responsive layout that works on desktop and mobile devices
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 11.1_

- [x] 12. Interactive Statistics Components
  - Build InteractiveManaCurve component with clickable CMC bars
  - Create ColorDistributionPie with selectable color segments
  - Implement TypeDistribution chart with card type breakdown
  - Add CardSynergyMap showing related card connections
  - Create hover and click interactions for filtering deck view
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 13. Card Detail and Management
  - Create CardDetailModal with full card information and context
  - Implement card role explanation and synergy highlighting
  - Add alternative and upgrade suggestions for each card
  - Build quantity adjustment controls with validation
  - Create card removal and replacement functionality
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1_

- [x] 14. Deck Strategy and Analysis Display
  - Build DeckStrategyPanel showing strategy description and win conditions
  - Create PlayPatternDescription component explaining typical game flow
  - Implement KeySynergies component highlighting important card interactions
  - Add DeckWeaknesses component showing potential vulnerabilities
  - Create UpgradeRecommendations section with improvement suggestions
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.2_

- [x] 15. Export and Integration Features
  - Implement deck export to text format with proper categorization
  - Add JSON export with full metadata and analysis
  - Create Moxfield-compatible export format
  - Build shareable deck links with embedded strategy information
  - Add print-friendly deck list formatting
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 16. Performance Optimization and Caching
  - Implement card image lazy loading and progressive enhancement
  - Add virtualization for large deck lists and card grids
  - Create caching layer for deck statistics and analysis
  - Optimize bundle size with code splitting and dynamic imports
  - Add debouncing for search and filter operations
  - _Requirements: 11.3, 11.4, 11.5_

- [x] 17. Mobile Responsiveness and UX
  - Optimize wizard steps for mobile screen sizes
  - Create touch-friendly interactions for card management
  - Implement swipe gestures for navigation where appropriate
  - Add mobile-specific loading states and progress indicators
  - Ensure all interactive elements meet accessibility standards
  - _Requirements: 11.1, 11.5_

- [x] 18. Error Handling and User Feedback
  - Implement comprehensive error boundaries for all major components
  - Add user-friendly error messages with recovery suggestions
  - Create loading states for all async operations
  - Build retry mechanisms for failed AI generation requests
  - Add success notifications and confirmation dialogs
  - _Requirements: 11.2, 11.4_

- [x] 19. Testing and Quality Assurance
  - Write unit tests for all wizard components and validation logic
  - Create integration tests for complete deck generation workflow
  - Add end-to-end tests covering full user journey from entry to completion
  - Implement performance tests for deck analysis and statistics calculation
  - Create accessibility tests ensuring WCAG compliance
  - _Requirements: All requirements - Quality assurance_

- [x] 20. Documentation and Deployment
  - Create user documentation for new deck building workflow
  - Write developer documentation for new API endpoints and components
  - Add inline help and tooltips for complex wizard steps
  - Create migration scripts for existing user data
  - Implement feature flags for gradual rollout of new functionality
  - _Requirements: Documentation and deployment_

- [x] 21. Commander Detail Modal Enhancement
  - Create CommanderDetailModal component with comprehensive commander information
  - Display full strategy description, win conditions, and power level analysis
  - Show detailed playstyle explanation with typical game patterns
  - Add budget breakdown and key card highlights for the commander
  - Include pros/cons analysis and meta positioning information
  - Implement modal trigger on commander card click (separate from selection)
  - Add responsive design for mobile and desktop viewing
  - Create smooth animations and transitions for modal open/close
  - _Requirements: 3.1, 3.2, 3.3, 8.1, 11.1_