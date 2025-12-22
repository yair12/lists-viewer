package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/yair12/lists-viewer/server/internal/api"
	"github.com/yair12/lists-viewer/server/internal/models"
	"github.com/yair12/lists-viewer/server/internal/service"
)

// ListHandler handles list-related HTTP requests
type ListHandler struct {
	service *service.ListService
}

// NewListHandler creates a new list handler
func NewListHandler(svc *service.ListService) *ListHandler {
	return &ListHandler{service: svc}
}

// GetAllLists retrieves all lists for the current user
// GET /api/v1/lists
func (h *ListHandler) GetAllLists(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	lists, err := h.service.GetAllLists(r.Context(), userID)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.ListsResponse{Data: lists})
}

// CreateList creates a new list
// POST /api/v1/lists
func (h *ListHandler) CreateList(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	var req models.CreateListRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	list, err := h.service.CreateList(r.Context(), &req, userID)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(list)
}

// GetList retrieves a specific list by ID
// GET /api/v1/lists/:id
func (h *ListHandler) GetList(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["id"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	list, err := h.service.GetList(r.Context(), listID, userID)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(list)
}

// UpdateList updates a list
// PUT /api/v1/lists/:id
func (h *ListHandler) UpdateList(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["id"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.UpdateListRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	list, err := h.service.UpdateList(r.Context(), listID, &req, userID)
	if err != nil {
		if err.Error() == "version_conflict" {
			api.ErrorResponse(w, http.StatusConflict, "version_conflict", "List was modified by another user", nil)
		} else {
			api.ErrorHandler(w, err)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(list)
}

// DeleteList deletes a list
// DELETE /api/v1/lists/:id
func (h *ListHandler) DeleteList(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["id"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.DeleteListRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	err := h.service.DeleteList(r.Context(), listID, userID, req.Version)
	if err != nil {
		if err.Error() == "version_conflict" {
			api.ErrorResponse(w, http.StatusConflict, "version_conflict", "List was modified by another user", nil)
		} else {
			api.ErrorHandler(w, err)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)

	w.WriteHeader(http.StatusNoContent)
}
