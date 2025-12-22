# Multi-stage build for Lists Viewer
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.24-alpine AS backend-builder

WORKDIR /app

COPY server/go.mod server/go.sum ./
RUN go mod download

COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server ./cmd/server

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
