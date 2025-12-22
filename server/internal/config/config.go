package config

import (
	"os"
)

type Config struct {
	ServerPort   string
	MongoDBURI   string
	DatabaseName string
}

func Load() (*Config, error) {
	cfg := &Config{
		ServerPort:   getEnv("SERVER_PORT", "8080"),
		MongoDBURI:   getEnv("MONGODB_URI", "mongodb://localhost:27017"),
		DatabaseName: getEnv("DATABASE_NAME", "lists_viewer"),
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
