package handler

import (
	"encoding/json"
	"net/http"

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
func (h *UserHandler) InitUser(w http.ResponseWriter, r *http.Request) {
	var req models.InitUserRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	user, err := h.service.InitUser(r.Context(), &req)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(user)
}

// GetIcons retrieves all available icons
// GET /api/v1/icons
func (h *UserHandler) GetIcons(w http.ResponseWriter, r *http.Request) {
	_, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	icons := h.service.GetAvailableIcons()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.IconsResponse{Data: icons})
}
