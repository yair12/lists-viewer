# Contributing to Lists Viewer

Thank you for your interest in contributing to Lists Viewer! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and constructive in all interactions. We're building a welcoming community.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** (`git checkout -b feature/your-feature`)
4. **Make your changes** following the guidelines below
5. **Test your changes** thoroughly
6. **Commit with clear messages** (`git commit -m 'Add feature: description'`)
7. **Push to your fork** (`git push origin feature/your-feature`)
8. **Create a Pull Request** on GitHub

## Development Setup

### Prerequisites

- Git
- Node.js 18+
- Go 1.21+
- Docker & Docker Compose
- MongoDB 5.0+ (or use Docker)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/yair12/lists-viewer.git
cd lists-viewer

# Copy environment files
cp .env.example .env
cp client/.env.example client/.env

# Start development environment
docker-compose up
```

### Running Locally Without Docker

**Backend:**
```bash
cd server
go mod download
go run ./cmd/server
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

**Database:**
```bash
docker run -d -p 27017:27017 mongo:5.0
```

## Coding Standards

### Go Backend

- Follow [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- Use `go fmt` for formatting
- Use `go vet` for linting
- Write tests for new functionality (target >80% coverage)
- Keep functions small and focused
- Use clear variable names

```bash
# Format code
go fmt ./...

# Run linter
go vet ./...

# Run tests
go test ./... -v
```

### TypeScript/React Frontend

- Use TypeScript for all new code
- Follow [Airbnb Style Guide](https://github.com/airbnb/javascript)
- Use ESLint and Prettier
- Write tests for components and utilities
- Keep components focused and reusable
- Use React hooks (no class components)

```bash
# Format code
npm run format

# Run linter
npm run lint

# Run tests
npm test

# Type checking
npm run type-check
```

## Commit Message Guidelines

Use clear, descriptive commit messages:

```
feat: Add new feature description
fix: Fix bug description
docs: Update documentation
style: Format code
refactor: Refactor component/function
test: Add or update tests
chore: Update dependencies
```

Example:
```
feat: Implement item reordering via drag-and-drop

- Add React Beautiful DnD integration
- Create ItemDragHandler component
- Add tests for drag-and-drop functionality
- Update API to support reorder endpoint
```

## Pull Request Guidelines

1. **Clear title** - Describe what the PR does
2. **Description** - Explain the changes and why
3. **Related issues** - Link to any related GitHub issues
4. **Tests** - Include tests for new functionality
5. **Documentation** - Update relevant documentation
6. **Screenshots** - Include UI changes (for frontend PRs)

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How to test these changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Code follows style guidelines
- [ ] No new warnings generated
```

## Testing

### Backend Testing

```bash
cd server

# Run all tests
go test ./...

# Run with coverage
go test ./... -cover

# Run specific test
go test ./internal/api/handler -v
```

### Frontend Testing

```bash
cd client

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Manual Testing

1. Test on desktop (Chrome, Firefox, Safari)
2. Test on mobile (iOS Safari, Chrome Mobile)
3. Test offline functionality
4. Test PWA installation
5. Test dark/light theme toggle

## Documentation

- Update relevant README files
- Add inline code comments for complex logic
- Update API documentation if endpoints change
- Include examples for new features

## Bug Reports

When reporting bugs, please include:

1. **Description** - What's the bug?
2. **Steps to reproduce** - How to replicate it
3. **Expected behavior** - What should happen
4. **Actual behavior** - What actually happens
5. **Environment** - OS, browser, versions
6. **Screenshots** - If applicable
7. **Logs** - Error messages or console logs

## Feature Requests

When suggesting features, please include:

1. **Title** - Clear feature name
2. **Use case** - Why is this needed?
3. **Implementation notes** - How you'd implement it
4. **Mockups** - UI sketches if applicable

## Code Review Process

1. **Automated checks** - Tests and linting must pass
2. **Manual review** - Team reviews code quality
3. **Discussion** - Questions or suggestions addressed
4. **Approval** - Approved by maintainers
5. **Merge** - Merged to main branch

## Project Structure Guidelines

When adding new features:

### Backend (Go)

```
server/internal/
├── api/handler/        # HTTP handlers
├── models/             # Data models
├── repository/         # Database operations
├── service/            # Business logic
└── database/           # Database setup
```

**Example**: Adding a new feature
1. Define model in `models/`
2. Add repository interface and implementation
3. Add service business logic
4. Create HTTP handlers
5. Add routes to `api/router.go`
6. Write tests

### Frontend (React)

```
client/src/
├── components/         # React components
├── hooks/              # Custom React hooks
├── services/           # API and storage
├── types/              # TypeScript types
└── utils/              # Helper functions
```

**Example**: Adding a new feature
1. Create component(s) in `components/`
2. Add types in `types/`
3. Create API service in `services/api/`
4. Create custom hook in `hooks/`
5. Write component tests

## Release Process

1. **Version bump** - Update version in relevant files
2. **Changelog** - Document changes
3. **Testing** - Full test suite passes
4. **Tag** - Create git tag
5. **Build** - Create Docker images
6. **Deploy** - Deploy to staging/production

## Getting Help

- **Issues** - Use GitHub Issues for bugs and features
- **Discussions** - Use GitHub Discussions for questions
- **Documentation** - Check `/specifications` directory

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Lists Viewer! 🎉
