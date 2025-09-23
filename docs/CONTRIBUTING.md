# Contributing to MoxMuse

Thank you for your interest in contributing to MoxMuse! This guide will help you get started with contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- **Be respectful**: Treat everyone with respect and kindness
- **Be inclusive**: Welcome newcomers and help them learn
- **Be constructive**: Provide helpful feedback and suggestions
- **Be patient**: Remember that everyone is learning and growing
- **Be collaborative**: Work together to build something amazing

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Git
- OpenAI API key

### Development Setup
1. Fork the repository on GitHub
2. Clone your fork locally
3. Follow the [Getting Started Guide](GETTING_STARTED.md)
4. Create a new branch for your changes

```bash
git clone https://github.com/your-username/moxmuse.git
cd moxmuse
pnpm install
cp env.example apps/web/.env.local
# Configure your environment variables
pnpm db:push
pnpm dev
```

## Development Workflow

### Branch Naming
Use descriptive branch names that indicate the type of change:

```bash
# Features
git checkout -b feature/commander-selection-ui
git checkout -b feature/deck-export-formats

# Bug fixes
git checkout -b fix/deck-generation-timeout
git checkout -b fix/mobile-responsive-layout

# Documentation
git checkout -b docs/api-reference-update
git checkout -b docs/contributing-guide

# Refactoring
git checkout -b refactor/component-organization
git checkout -b refactor/database-queries
```

### Commit Messages
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
# Format
<type>[optional scope]: <description>

# Examples
feat(tutor): add commander selection wizard
fix(deck): resolve card quantity validation bug
docs(api): update tRPC procedure documentation
refactor(components): reorganize UI component structure
test(e2e): add deck generation workflow tests
```

#### Commit Types
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following our coding standards
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run the test suite** to ensure everything works
6. **Create a pull request** with a clear description

#### Pull Request Template
```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
```

## Coding Standards

### TypeScript
- Use strict TypeScript configuration
- Provide explicit return types for functions
- Use interfaces for object shapes
- Use type unions for string literals
- Follow naming conventions (see [Style Guide](STYLE_GUIDE.md))

### React Components
- Use functional components with hooks
- Implement proper error boundaries
- Use TypeScript for all props
- Follow component organization patterns
- Add proper accessibility attributes

### Testing
- Write unit tests for utilities and hooks
- Add component tests for UI components
- Create integration tests for API endpoints
- Include E2E tests for critical user flows
- Maintain test coverage above 80%

### Documentation
- Update relevant documentation for changes
- Add JSDoc comments for public APIs
- Include examples in documentation
- Keep README files current

## Project Structure

### Key Directories
```
moxmuse/
├── apps/web/                 # Next.js frontend application
│   ├── app/                  # App router pages and layouts
│   ├── src/                  # Source code
│   │   ├── components/       # React components
│   │   │   ├── ui/          # Base UI components
│   │   │   └── tutor/       # Feature-specific components
│   │   ├── lib/             # Utilities and configurations
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript type definitions
│   └── public/              # Static assets
├── packages/
│   ├── api/                 # tRPC API layer
│   ├── db/                  # Database schema and migrations
│   └── shared/              # Shared types and utilities
└── docs/                    # Project documentation
```

### Adding New Features

#### 1. Plan Your Feature
- Review existing issues or create a new one
- Discuss the approach with maintainers
- Break down the work into manageable tasks
- Consider impact on existing functionality

#### 2. Database Changes
If your feature requires database changes:

```bash
# Create a new migration
npx prisma migrate dev --name add_new_feature

# Update the schema
# Edit packages/db/prisma/schema.prisma

# Generate the client
pnpm db:generate
```

#### 3. API Changes
For new tRPC procedures:

```typescript
// Add to appropriate router in packages/api/src/routers/
export const newFeatureRouter = createTRPCRouter({
  newProcedure: protectedProcedure
    .input(NewFeatureSchema)
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
})

// Add Zod validation schema
const NewFeatureSchema = z.object({
  // Define input validation
})
```

#### 4. Frontend Components
Create new components following our patterns:

```typescript
// components/feature/NewComponent.tsx
interface NewComponentProps {
  // Define props with TypeScript
}

export const NewComponent: React.FC<NewComponentProps> = ({
  // Props destructuring
}) => {
  // Hooks at the top
  // Event handlers
  // Effects
  // Early returns
  // Main render
}
```

#### 5. Testing
Add comprehensive tests:

```typescript
// Unit tests
describe('NewComponent', () => {
  it('should render correctly', () => {
    // Test implementation
  })
})

// Integration tests
describe('newFeature API', () => {
  it('should handle valid input', async () => {
    // Test implementation
  })
})

// E2E tests
test('user can use new feature', async ({ page }) => {
  // Test implementation
})
```

## Areas for Contribution

### High Priority
- **AI Deck Building Improvements**: Enhance generation quality and speed
- **Mobile Experience**: Improve responsive design and touch interactions
- **Performance Optimization**: Reduce bundle size and improve loading times
- **Accessibility**: Ensure WCAG compliance across all components
- **Error Handling**: Improve error messages and recovery flows

### Medium Priority
- **Collection Management**: Enhance import/export capabilities
- **Social Features**: Add deck sharing and community features
- **Testing**: Increase test coverage and add more E2E tests
- **Documentation**: Improve user guides and API documentation
- **Internationalization**: Add support for multiple languages

### Good First Issues
- **UI Polish**: Improve component styling and animations
- **Bug Fixes**: Resolve reported issues and edge cases
- **Documentation**: Update guides and add examples
- **Testing**: Add missing test cases
- **Accessibility**: Add ARIA labels and keyboard navigation

## Review Process

### Code Review Guidelines
- **Be constructive**: Provide helpful feedback and suggestions
- **Be specific**: Point out exact issues and suggest solutions
- **Be timely**: Review pull requests within 2-3 business days
- **Be thorough**: Check code quality, tests, and documentation
- **Be respectful**: Remember there's a person behind the code

### What Reviewers Look For
- **Functionality**: Does the code work as intended?
- **Code Quality**: Is the code clean, readable, and maintainable?
- **Performance**: Are there any performance implications?
- **Security**: Are there any security concerns?
- **Testing**: Are there adequate tests for the changes?
- **Documentation**: Is the documentation updated appropriately?

### Addressing Review Feedback
- **Respond promptly**: Address feedback within a few days
- **Ask questions**: If feedback is unclear, ask for clarification
- **Make changes**: Update your code based on the feedback
- **Test thoroughly**: Ensure changes don't break existing functionality
- **Update documentation**: Keep docs in sync with code changes

## Release Process

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Cycle
- **Weekly**: Patch releases for bug fixes
- **Monthly**: Minor releases for new features
- **Quarterly**: Major releases for significant changes

## Getting Help

### Communication Channels
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Discord**: For real-time chat and community support
- **Email**: For security issues and private matters

### Documentation Resources
- [Getting Started Guide](GETTING_STARTED.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Style Guide](STYLE_GUIDE.md)
- [API Reference](API_REFERENCE.md)
- [Deployment Guide](DEPLOYMENT.md)

### Common Questions

#### "How do I run the project locally?"
Follow the [Getting Started Guide](GETTING_STARTED.md) for detailed setup instructions.

#### "How do I add a new component?"
Check the [Style Guide](STYLE_GUIDE.md) for component patterns and organization.

#### "How do I add a new API endpoint?"
See the [API Reference](API_REFERENCE.md) for tRPC procedure patterns.

#### "How do I run tests?"
```bash
pnpm test          # Unit tests
pnpm test:e2e      # E2E tests
pnpm test:watch    # Watch mode
```

#### "How do I deploy changes?"
See the [Deployment Guide](DEPLOYMENT.md) for production deployment instructions.

## Recognition

Contributors are recognized in several ways:
- **Contributors list**: Added to the project README
- **Release notes**: Mentioned in release announcements
- **Community highlights**: Featured in community updates
- **Maintainer status**: Active contributors may be invited as maintainers

## License

By contributing to MoxMuse, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to MoxMuse! Your efforts help make the best deck building tool for the Magic: The Gathering community. 🎴✨

## AI Contribution Guidelines (Cursor + GPT‑5)
- Use todos to outline multi‑step changes and keep them updated.
- Prefer minimal, targeted edits; avoid broad refactors without approval.
- After edits, run type‑check/lint for the affected package(s) and fix regressions.
- Use code references for existing code and fenced blocks only for new code samples.
- Do not commit secrets or .env files. Follow security docs.
- Keep PR descriptions concise with a short “impact” section and validation notes.