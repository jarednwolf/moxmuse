# AI Deck Building Tutor Test Suite

This directory contains comprehensive tests for the AI Deck Building Tutor feature, covering unit tests, integration tests, end-to-end tests, performance tests, and accessibility tests.

## Test Structure

### Unit Tests
- **Wizard Components**: Tests for all wizard step components and validation logic
- **Entry Point Selector**: Tests for the main entry point selection interface
- **Generation Engine**: Tests for deck generation workflow and progress tracking
- **Deck Editor**: Tests for the advanced deck editing interface
- **Validation Logic**: Tests for all form validation and data validation functions

### Integration Tests
- **Complete Workflow**: Tests the full user journey from entry point to deck completion
- **Data Persistence**: Tests that data is properly maintained throughout the workflow
- **API Integration**: Tests the integration with tRPC endpoints and external services
- **Component Communication**: Tests how components interact with each other

### End-to-End Tests
- **Full User Journey**: Complete workflow testing using Playwright
- **Error Handling**: Tests error scenarios and recovery mechanisms
- **Mobile Responsiveness**: Tests mobile-specific functionality and layouts
- **Accessibility Compliance**: Tests keyboard navigation and screen reader support
- **Performance Benchmarks**: Tests page load times and interaction responsiveness

### Performance Tests
- **Deck Analysis**: Tests performance of deck statistics calculation
- **Large Dataset Handling**: Tests with large numbers of cards and complex operations
- **Memory Usage**: Tests memory efficiency during analysis operations
- **Concurrent Operations**: Tests handling of multiple simultaneous operations

### Accessibility Tests
- **WCAG Compliance**: Tests compliance with Web Content Accessibility Guidelines
- **Screen Reader Support**: Tests proper ARIA labels and semantic markup
- **Keyboard Navigation**: Tests full keyboard accessibility
- **Color Contrast**: Tests sufficient color contrast ratios
- **Focus Management**: Tests proper focus handling in modals and navigation

## Test Coverage Areas

### Wizard Components
- ✅ CommanderStep - Commander selection and input validation
- ✅ StrategyStep - Strategy selection and theme configuration
- ✅ BudgetStep - Budget selection and collection preferences
- ✅ PowerLevelStep - Power level selection with explanations
- ✅ WinConditionsStep - Win condition configuration
- ✅ InteractionStep - Interaction level and type selection
- ✅ RestrictionsStep - Card and strategy restrictions
- ✅ ComplexityStep - Deck complexity preferences
- ✅ SummaryStep - Final review and validation

### Core Components
- ✅ EntryPointSelector - Main entry point selection
- ✅ DeckBuildingOption - Full deck building option
- ✅ CardRecommendationOption - Individual card recommendation option
- ✅ GenerationProgress - Deck generation progress tracking
- ✅ DeckGenerationEngine - Complete deck generation workflow

### Validation and Logic
- ✅ Wizard validation functions
- ✅ Data persistence and state management
- ✅ Error handling and recovery
- ✅ Form validation and user input sanitization

### Performance Critical Areas
- ✅ Deck statistics calculation
- ✅ Large dataset processing
- ✅ Memory usage optimization
- ✅ Concurrent operation handling

### Accessibility Features
- ✅ ARIA labels and semantic markup
- ✅ Keyboard navigation support
- ✅ Screen reader compatibility
- ✅ Color contrast compliance
- ✅ Focus management

## Running Tests

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test -- --testPathPattern=integration
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Performance Tests
```bash
npm run test -- --testPathPattern=performance
```

### Accessibility Tests
```bash
npm run test -- --testPathPattern=accessibility
```

### All Tests
```bash
npm run test:run
```

## Test Configuration

The test suite uses:
- **Vitest** for unit and integration tests
- **React Testing Library** for component testing
- **Playwright** for end-to-end testing
- **jest-axe** for accessibility testing
- **Performance API** for performance benchmarking

## Mock Strategy

Tests use comprehensive mocking for:
- tRPC API calls
- External service integrations
- Large dataset generation
- Component dependencies
- Browser APIs and performance monitoring

## Coverage Goals

- **Unit Tests**: 90%+ coverage for all components and utilities
- **Integration Tests**: Complete workflow coverage
- **E2E Tests**: Critical user journey coverage
- **Performance Tests**: All performance-critical operations
- **Accessibility Tests**: WCAG 2.1 AA compliance

## Continuous Integration

Tests are configured to run in CI/CD pipelines with:
- Parallel test execution
- Coverage reporting
- Performance regression detection
- Accessibility compliance verification
- Cross-browser compatibility testing

## Test Data

Test data includes:
- Mock consultation data for all wizard steps
- Generated deck samples with various configurations
- Performance test datasets of varying sizes
- Accessibility test scenarios for different user needs

## Known Issues and Limitations

1. Some tests may fail if corresponding components are not yet implemented
2. Performance tests require specific hardware configurations for accurate benchmarking
3. E2E tests require proper environment setup and API mocking
4. Accessibility tests may need manual verification for complex interactions

## Contributing

When adding new features:
1. Write unit tests for all new components
2. Add integration tests for new workflows
3. Update E2E tests for user-facing changes
4. Include performance tests for data-heavy operations
5. Verify accessibility compliance for all UI changes

## Future Improvements

- Add visual regression testing
- Implement automated performance monitoring
- Expand cross-browser testing coverage
- Add internationalization testing
- Include security testing for user inputs