package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
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
func (h *HealthHandler) LivenessProbe(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Status: "alive",
	})
}

// ReadinessProbe returns 200 if the server is ready to serve requests
func (h *HealthHandler) ReadinessProbe(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := h.service.CheckDatabaseHealth(ctx)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, HealthResponse{
			Status:   "not_ready",
			Database: "disconnected",
		})
		return
	}

	c.JSON(http.StatusOK, HealthResponse{
		Status:   "ready",
		Database: "connected",
	})
}
