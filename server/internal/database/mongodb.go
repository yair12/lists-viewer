package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/yair12/lists-viewer/server/internal/config"
)

func NewMongoClient(cfg *config.Config) (*mongo.Client, error) {
	log.Printf("[DATABASE] Connecting to MongoDB...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoDBURI))
	if err != nil {
		log.Printf("[DATABASE] Failed to connect to MongoDB: %v", err)
		return nil, err
	}

	// Verify connection
	log.Printf("[DATABASE] Verifying MongoDB connection...")
	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx, nil); err != nil {
		log.Printf("[DATABASE] Failed to ping MongoDB: %v", err)
		return nil, err
	}

	log.Printf("[DATABASE] Successfully connected to MongoDB")
	return client, nil
}
