# Lists Viewer

A Progressive Web App (PWA) for managing todo lists and checklists with offline-first support, collaborative features, and a native-like experience.

![Status](https://img.shields.io/badge/Status-Phase%201%20Complete-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

✅ **Hierarchical List Management** - Create lists with up to 2 levels of nesting
✅ **Full CRUD Operations** - Create, read, update, and delete lists and items
✅ **Offline Support** - Complete offline functionality with automatic sync queue
✅ **Optimistic Locking** - Conflict resolution for concurrent edits
✅ **Dark Theme** - Material-UI dark theme with smooth animations
✅ **PWA Installation** - Install on desktop, mobile (iOS/Android)
✅ **Responsive Design** - Works seamlessly on all devices
✅ **Item Reordering** - Drag and drop to reorder lists and items

## Tech Stack

### Backend
- **Go 1.21+** - High-performance REST API server
- **Gin-Gonic** - Lightweight web framework
- **MongoDB 5.0+** - Document-based persistence
- **Docker & Kubernetes** - Container orchestration
- **Helm** - Kubernetes package management

### Frontend
- **React 18.0+** - UI component library
- **TypeScript** - Type-safe development
- **Vite 5.0+** - Fast build tool and dev server
- **Material-UI v5** - Component library
- **TanStack Query** - Server state management
- **Workbox** - Service Worker for PWA

## Project Structure

```
lists-viewer/
├── server/                 # Go backend
│   ├── cmd/               # Application entry point
│   ├── internal/          # Business logic
│   └── Dockerfile         # Container image
├── client/                # React frontend
│   ├── src/               # React components
│   ├── public/            # Static assets
│   └── vite.config.ts     # Build configuration
├── helm/                  # Kubernetes charts
├── docker-compose.yml     # Local development setup
└── specifications/        # Project specifications
```

## Quick Start

### Prerequisites

- Node.js 18+ (for frontend)
- Go 1.21+ (for backend)
- Docker & Docker Compose (for containerized setup)
- MongoDB 5.0+ (or use Docker)

### Using Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/yair12/lists-viewer.git
cd lists-viewer

# Start all services
docker-compose up

# Frontend: http://localhost:5173
# Backend API: http://localhost:8080
# MongoDB: mongodb://localhost:27017
```

### Manual Setup

#### Backend

```bash
cd server
go mod download
go run ./cmd/server
```

Server runs on `http://localhost:8080`

#### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

#### Database

```bash
docker run -d -p 27017:27017 --name mongodb mongo:5.0
```

## Development

### Running Tests

```bash
# Backend tests
cd server
go test ./...

# Frontend tests
cd client
npm test
```

### Code Quality

```bash
# Backend linting
cd server
go fmt ./...
go vet ./...

# Frontend linting
cd client
npm run lint
```

### Building for Production

```bash
# Backend Docker image
cd server
docker build -t lists-viewer-server:latest .

# Frontend production build
cd client
npm run build
```

## API Documentation

The API follows OpenAPI 3.0 specification. See `/specifications/plan/IMPLEMENTATION_SPEC.md` for detailed API documentation.

### Main Endpoints

- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /api/v1/lists` - Get all lists
- `POST /api/v1/lists` - Create list
- `GET /api/v1/lists/{id}/items` - Get items in list
- `POST /api/v1/lists/{id}/items` - Create item

## Kubernetes Deployment

```bash
# Deploy to Kubernetes using Helm
helm install lists-viewer ./helm/lists-viewer \
  --namespace lists-viewer \
  --create-namespace \
  -f helm/lists-viewer/values-prod.yaml
```

See [Helm README](./helm/lists-viewer/README.md) for detailed instructions.

## Implementation Phases

The project is organized in 8 phases with 20 weeks total timeline:

1. **Phase 1: Project Setup & Infrastructure** (Weeks 1-2) ✅ **COMPLETE**
2. **Phase 2: Backend Core API** (Weeks 3-5)
3. **Phase 3: Frontend Core UI** (Weeks 6-8)
4. **Phase 4: Offline Data Management** (Weeks 9-11)
5. **Phase 5: Offline Sync & Conflict Resolution** (Weeks 12-14)
6. **Phase 6: Testing & Documentation** (Weeks 15-16)
7. **Phase 7: Deployment & Optimization** (Weeks 17-18)
8. **Phase 8: Polish & Release** (Weeks 19-20)

For detailed implementation specs, see [IMPLEMENTATION_SPEC.md](./specifications/plan/IMPLEMENTATION_SPEC.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see LICENSE file for details

## Contact

For questions or suggestions, please open an issue on GitHub.

---

**Created**: December 22, 2025  
**Current Version**: 0.0.1  
**Phase 1 Status**: ✅ Complete
