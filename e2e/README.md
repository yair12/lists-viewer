# E2E Tests for Lists Viewer

End-to-end tests using Playwright and TestContainers to test the full application stack with a real MongoDB instance and Go server.

## Setup

Install dependencies:
```bash
npm install
```

## Running Tests

Run all E2E tests:
```bash
npm test
```

Run specific test suites:
```bash
# Offline workflow tests
npm run test:offline

# Multi-tab conflict tests
npm run test:multi-tab
```

Run tests in headed mode (see browser):
```bash
npm run test:headed
```

Run tests in UI mode (interactive):
```bash
npm run test:ui
```

Debug tests:
```bash
npm run test:debug
```

View test report:
```bash
npm run report
```

## Test Architecture

### Infrastructure
- **MongoDB**: Spun up via TestContainers before tests run
- **Go Server**: Built and started with test MongoDB connection
- **Client Dev Server**: Auto-started by Playwright on port 5173
- **Single Worker**: Tests run sequentially for TestContainers compatibility

### Global Setup/Teardown
- `tests/global-setup.ts`: Starts MongoDB container + Go server
- `tests/global-teardown.ts`: Stops MongoDB container + Go server

### Custom Fixtures
- `tests/fixtures.ts`: Provides authenticated pages and API helpers
  - `apiHelper`: HTTP client for test data creation
  - `testUser`: Auto-created user with cleanup
  - `authenticatedPage`: Pre-authenticated page with user in localStorage

### Test Suites

#### Offline Workflows (`tests/offline-workflows.spec.ts`)
Tests offline-first functionality:
- Create items offline → sync when online
- Update items offline → sync on reconnect
- Interrupted sync recovery
- Toggle completion offline (quantity preservation)
- Delete items offline → sync
- Rapid network toggling
- Offline indicator visibility

#### Multi-Tab Conflicts (`tests/multi-tab-conflicts.spec.ts`)
Tests concurrent editing across browser tabs:
- Version conflict detection
- Conflict resolution (use_server vs use_local)
- Delete conflicts
- Concurrent reorder operations (documents vulnerability)
- Bulk complete during edit
- Cross-tab sync behavior

## Configuration

Edit `playwright.config.ts` to modify:
- Test timeout
- Screenshot/video capture
- Trace collection
- Retry logic
- Base URL

## CI/CD Integration

The `.github/workflows/playwright.yml` file is generated for GitHub Actions integration.

To run in CI:
1. Ensure Docker is available (for TestContainers)
2. Node.js 18+ installed
3. Go 1.21+ installed (for server build)

## Troubleshooting

**MongoDB container won't start:**
- Ensure Docker is running
- Check Docker permissions
- Try `docker pull mongo:5.0` manually

**Server won't start:**
- Check server build succeeds: `cd ../server && go build -o server ./cmd/server`
- Verify port 8080 is available
- Check MongoDB connection string in logs

**Client won't start:**
- Ensure client dependencies installed: `cd ../client && npm install`
- Check port 5173 is available
- Verify Vite config is correct

**Tests timeout:**
- Increase timeout in `playwright.config.ts`
- Check network connectivity
- Verify all services started correctly in global-setup logs
