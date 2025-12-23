package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/yair12/lists-viewer/server/internal/service"
)

type HealthHandler struct {
	service *service.HealthService
}

func NewHealthHandler(svc *service.HealthService) *HealthHandler {
	return &HealthHandler{
		service: svc,
	}
}

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database,omitempty"`
}

// LivenessProbe returns 200 if the server is alive
func (h *HealthHandler) LivenessProbe(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(HealthResponse{
		Status: "alive",
	})
}

// ReadinessProbe returns 200 if the server is ready to serve requests
func (h *HealthHandler) ReadinessProbe(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := h.service.CheckDatabaseHealth(ctx)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(HealthResponse{
			Status:   "not_ready",
			Database: "disconnected",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(HealthResponse{
		Status:   "ready",
		Database: "connected",
	})
}
