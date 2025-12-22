package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yair12/lists-viewer/server/internal/api"
	"github.com/yair12/lists-viewer/server/internal/models"
	"github.com/yair12/lists-viewer/server/internal/service"
)

// UserHandler handles user-related HTTP requests
type UserHandler struct {
	service *service.UserService
}

// NewUserHandler creates a new user handler
func NewUserHandler(svc *service.UserService) *UserHandler {
	return &UserHandler{service: svc}
}

// InitUser initializes or retrieves a user
// POST /api/v1/users/init
func (h *UserHandler) InitUser(c *gin.Context) {
	var req models.InitUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	user, err := h.service.InitUser(c.Request.Context(), &req)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetIcons retrieves all available icons
// GET /api/v1/icons
func (h *UserHandler) GetIcons(c *gin.Context) {
	_, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	icons := h.service.GetAvailableIcons()
	c.JSON(http.StatusOK, models.IconsResponse{Data: icons})
}
