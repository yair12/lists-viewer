package service

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
)

// HealthService handles health check operations
type HealthService struct {
	dbClient *mongo.Client
}

// NewHealthService creates a new health service
func NewHealthService(dbClient *mongo.Client) *HealthService {
	return &HealthService{dbClient: dbClient}
}

// CheckDatabaseHealth checks if the database is accessible
func (s *HealthService) CheckDatabaseHealth(ctx context.Context) error {
	return s.dbClient.Ping(ctx, nil)
}

// IsReady checks if the service is ready to serve requests
func (s *HealthService) IsReady() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := s.CheckDatabaseHealth(ctx)
	return err == nil
}
