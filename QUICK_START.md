# Quick Reference Guide

## Starting Development

### Option 1: Using Docker Compose (Recommended)
```bash
cd /home/echelon/Storage/Projects/lists-viewer
docker-compose up
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- MongoDB: mongodb://localhost:27017
- API Health: http://localhost:8080/health/ready

### Option 2: Manual Start

**Terminal 1 - MongoDB:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:5.0
```

**Terminal 2 - Backend:**
```bash
cd server
go mod download
go run ./cmd/server
```

**Terminal 3 - Frontend:**
```bash
cd client
npm install
npm run dev
```

---

## Common Commands

### Backend (Go)

```bash
cd server

# Install dependencies
go mod download
go mod tidy

# Run server
go run ./cmd/server

# Run tests
go test ./...

# Run with coverage
go test ./... -cover

# Format code
go fmt ./...

# Lint code
go vet ./...

# Build binary
go build -o bin/server ./cmd/server
```

### Frontend (React)

```bash
cd client

# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm test
```

### Docker & Kubernetes

```bash
# Build backend image
cd server
docker build -t lists-viewer-server:latest .

# Build frontend image
cd ../client
docker build -t lists-viewer-client:latest .

# Docker Compose
docker-compose up          # Start all services
docker-compose down        # Stop all services
docker-compose logs -f     # View logs

# Helm chart validation
helm lint helm/lists-viewer

# Helm install (Kubernetes)
helm install lists-viewer ./helm/lists-viewer \
  --namespace lists-viewer \
  --create-namespace \
  -f helm/lists-viewer/values-dev.yaml

# Helm upgrade
helm upgrade lists-viewer ./helm/lists-viewer \
  -f helm/lists-viewer/values-dev.yaml

# Helm uninstall
helm uninstall lists-viewer --namespace lists-viewer
```

---

## Project Files Location

| Component | Path |
|-----------|------|
| **Backend** | `/server` |
| **Frontend** | `/client` |
| **Helm Charts** | `/helm/lists-viewer` |
| **Specifications** | `/specifications` |
| **Docker Compose** | `/docker-compose.yml` |
| **Git Ignore** | `/.gitignore` |
| **Main README** | `/README.md` |
| **Contributing Guide** | `/CONTRIBUTING.md` |
| **Phase 1 Summary** | `/PHASE_1_COMPLETE.md` |

---

## Environment Variables

### Backend
```env
SERVER_PORT=8080
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=lists_viewer
```

### Frontend
```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

### Docker Compose
- All environment variables are configured in `docker-compose.yml`
- MongoDB credentials: `root` / `rootpassword`

---

## API Testing

### Health Endpoints
```bash
# Liveness
curl http://localhost:8080/health/live

# Readiness (checks database)
curl http://localhost:8080/health/ready
```

### Example: Create a List (Phase 2)
```bash
curl -X POST http://localhost:8080/api/v1/lists \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user1" \
  -d '{
    "name": "Grocery List",
    "description": "Weekly shopping"
  }'
```

---

## Troubleshooting

### Backend won't start
```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check port 8080 is free
lsof -i :8080

# View backend logs
docker-compose logs backend
```

### Frontend won't compile
```bash
# Clear node_modules and reinstall
cd client
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf .vite
npm run dev
```

### MongoDB connection issues
```bash
# Check MongoDB is running
docker ps | grep mongodb

# Test connection
mongosh mongodb://root:rootpassword@localhost:27017

# View MongoDB logs
docker-compose logs mongodb
```

### Docker Compose issues
```bash
# Rebuild all containers
docker-compose down
docker-compose build --no-cache
docker-compose up

# Check health
docker-compose ps
```

---

## Resources

- **Backend README**: `/server/README.md`
- **Frontend README**: `/client/README.md`
- **Helm README**: `/helm/lists-viewer/README.md`
- **Implementation Spec**: `/specifications/plan/IMPLEMENTATION_SPEC.md`
- **Requirements**: `/specifications/REQUIREMENTS.md`
- **Contributing Guide**: `/CONTRIBUTING.md`

---

## Phase Timeline

- ✅ **Phase 1**: Project Setup & Infrastructure (Weeks 1-2)
- ⏳ **Phase 2**: Backend Core API (Weeks 3-5) - NEXT
- ⏳ **Phase 3**: Frontend Core UI (Weeks 6-8)
- ⏳ **Phase 4**: Offline Data Management (Weeks 9-11)
- ⏳ **Phase 5**: Offline Sync & Conflict Resolution (Weeks 12-14)
- ⏳ **Phase 6**: Testing & Documentation (Weeks 15-16)
- ⏳ **Phase 7**: Deployment & Optimization (Weeks 17-18)
- ⏳ **Phase 8**: Polish & Release (Weeks 19-20)

---

**Last Updated**: December 22, 2025  
**Current Phase**: Phase 1 Complete ✅
