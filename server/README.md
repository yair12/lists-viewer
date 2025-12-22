# Lists Viewer - Backend (Server)

A high-performance REST API server built with Go, Gin, and MongoDB for managing lists and items with offline-first support.

## Technology Stack

- **Language**: Go 1.21+
- **Web Framework**: Gin-Gonic
- **Database**: MongoDB 5.0+
- **API**: RESTful with OpenAPI specification
- **Container**: Docker

## Project Structure

```
server/
├── cmd/server/
│   └── main.go              # Application entry point
├── internal/
│   ├── api/
│   │   ├── handler/         # HTTP request handlers
│   │   ├── router.go        # Route definitions
│   │   └── middleware.go    # Request middleware
│   ├── models/              # Data models
│   ├── repository/          # Database operations
│   ├── service/             # Business logic
│   ├── database/            # Database initialization
│   └── config/              # Configuration management
├── go.mod                   # Go module definition
├── Dockerfile               # Container image definition
└── README.md               # This file
```

## Getting Started

### Prerequisites

- Go 1.21 or higher
- MongoDB 5.0 or higher (local or Docker)
- Docker (for containerization)

### Local Development

1. **Set up MongoDB locally** (using Docker):
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo:5.0
   ```

2. **Download dependencies**:
   ```bash
   go mod download
   ```

3. **Run the server**:
   ```bash
   go run ./cmd/server
   ```

   The server will start on `http://localhost:8080`

### Environment Variables

```env
SERVER_PORT=8080                          # Server port
MONGODB_URI=mongodb://localhost:27017     # MongoDB connection string
DATABASE_NAME=lists_viewer                # Database name
```

## API Endpoints

### Health Check

- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe with database check

### Lists (To be implemented)

- `GET /api/v1/lists` - Get all lists
- `POST /api/v1/lists` - Create a new list
- `GET /api/v1/lists/{id}` - Get list by ID
- `PUT /api/v1/lists/{id}` - Update list
- `DELETE /api/v1/lists/{id}` - Delete list

### Items (To be implemented)

- `GET /api/v1/lists/{listId}/items` - Get items in a list
- `POST /api/v1/lists/{listId}/items` - Create item
- `PUT /api/v1/lists/{listId}/items/{itemId}` - Update item
- `DELETE /api/v1/lists/{listId}/items/{itemId}` - Delete item
- `PATCH /api/v1/lists/{listId}/items/reorder` - Reorder items
- `PATCH /api/v1/lists/{listId}/items/complete` - Bulk complete items

## Building

### Docker Build

```bash
# Development build
docker build -t lists-viewer-server:latest .

# Run container
docker run -p 8080:8080 -e MONGODB_URI=mongodb://host.docker.internal:27017 lists-viewer-server:latest
```

## Testing

```bash
go test ./...
```

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) file in the project root.

## License

MIT
