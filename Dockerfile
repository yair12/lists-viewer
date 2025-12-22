# Multi-stage build for Lists Viewer
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# Copy package files first for better caching
COPY client/package*.json ./

# Install dependencies with npm ci (faster and more reliable for CI/CD)
# Also use --prefer-offline to use cache when possible
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy source files
COPY client/ ./

# Build with optimizations
RUN npm run build

# Stage 2: Build backend
FROM golang:1.24-alpine AS backend-builder

WORKDIR /app

# Copy go mod files first for better caching
COPY server/go.mod server/go.sum ./
RUN go mod download

# Copy source and build
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o server ./cmd/server

# Stage 3: Runtime
FROM alpine:latest

RUN apk --no-cache add ca-certificates wget

WORKDIR /root/

# Copy backend binary
COPY --from=backend-builder /app/server .

# Copy frontend static files
COPY --from=frontend-builder /app/client/dist ./public

EXPOSE 8080

CMD ["./server"]
