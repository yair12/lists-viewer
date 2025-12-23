package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/yair12/lists-viewer/server/internal/api"
	"github.com/yair12/lists-viewer/server/internal/models"
	"github.com/yair12/lists-viewer/server/internal/service"
)

// ItemHandler handles item-related HTTP requests
type ItemHandler struct {
	service *service.ItemService
}

// NewItemHandler creates a new item handler
func NewItemHandler(svc *service.ItemService) *ItemHandler {
	return &ItemHandler{service: svc}
}

// GetItemsByList retrieves all items in a list
// GET /api/v1/lists/:listId/items
func (h *ItemHandler) GetItemsByList(w http.ResponseWriter, r *http.Request) {
	_, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["listId"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	includeArchived := r.URL.Query().Get("includeArchived") == "true"

	items, err := h.service.GetItemsByList(r.Context(), listID, includeArchived)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.ItemsResponse{Data: items})
}

// CreateItem creates a new item
// POST /api/v1/lists/:listId/items
func (h *ItemHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["listId"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.CreateItemRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	item, err := h.service.CreateItem(r.Context(), listID, &req, userID)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

// GetItem retrieves a specific item
// GET /api/v1/lists/:listId/items/:itemId
func (h *ItemHandler) GetItem(w http.ResponseWriter, r *http.Request) {
	_, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	vars := mux.Vars(r)
	listID := vars["listId"]
	itemID := vars["itemId"]

	if listID == "" || itemID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID and Item ID are required", nil)
		return
	}

	item, err := h.service.GetItem(r.Context(), listID, itemID)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(item)
}

// UpdateItem updates an item
// PUT /api/v1/lists/:listId/items/:itemId
func (h *ItemHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	vars := mux.Vars(r)
	listID := vars["listId"]
	itemID := vars["itemId"]

	if listID == "" || itemID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID and Item ID are required", nil)
		return
	}

	var req models.UpdateItemRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	item, err := h.service.UpdateItem(r.Context(), listID, itemID, &req, userID)
	if err != nil {
		if err.Error() == "version_conflict" {
			api.ErrorResponse(w, http.StatusConflict, "version_conflict", "Item was modified by another user", nil)
		} else {
			api.ErrorHandler(w, err)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(item)
}

// DeleteItem deletes an item
// DELETE /api/v1/lists/:listId/items/:itemId
func (h *ItemHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	vars := mux.Vars(r)
	listID := vars["listId"]
	itemID := vars["itemId"]

	if listID == "" || itemID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID and Item ID are required", nil)
		return
	}

	var req models.DeleteItemRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	err := h.service.DeleteItem(r.Context(), listID, itemID, userID, req.Version)
	if err != nil {
		log.Printf("[HANDLER_DELETE_ITEM] Service returned error for uuid=%s: error=%v, error_string=%s", itemID, err, err.Error())
		if strings.Contains(err.Error(), "version_conflict") {
			log.Printf("[HANDLER_DELETE_ITEM] Returning 409 Conflict for uuid=%s", itemID)
			api.ErrorResponse(w, http.StatusConflict, "version_conflict", "Item was modified by another user", nil)
		} else {
			log.Printf("[HANDLER_DELETE_ITEM] Calling ErrorHandler for uuid=%s", itemID)
			api.ErrorHandler(w, err)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ReorderItems reorders items in a list
// PATCH /api/v1/lists/:listId/items/reorder
func (h *ItemHandler) ReorderItems(w http.ResponseWriter, r *http.Request) {
	_, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["listId"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.ReorderItemsRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	items, err := h.service.ReorderItems(r.Context(), listID, req.Items)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.ReorderResponse{Data: items})
}

// BulkCompleteItems completes multiple items
// PATCH /api/v1/lists/:listId/items/complete
func (h *ItemHandler) BulkCompleteItems(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["listId"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.BulkCompleteRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	log.Printf("BulkCompleteItems: listID=%s, itemIDs=%v, userID=%s", listID, req.ItemIDs, userID)
	items, err := h.service.BulkCompleteItems(r.Context(), listID, req.ItemIDs, userID)
	if err != nil {
		log.Printf("BulkCompleteItems ERROR: %v", err)
		api.ErrorHandler(w, err)
		return
	}
	log.Printf("BulkCompleteItems SUCCESS: completed %d items", len(items))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.BulkCompleteResponse{
		CompletedCount: int(len(items)),
		Data:           items,
	})
}

// BulkDeleteItems deletes multiple items
// DELETE /api/v1/lists/:listId/items
func (h *ItemHandler) BulkDeleteItems(w http.ResponseWriter, r *http.Request) {
	_, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["listId"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.BulkDeleteRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	count, err := h.service.BulkDeleteItems(r.Context(), listID, req.ItemIDs)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.BulkDeleteResponse{DeletedCount: int(count)})
}

// DeleteCompletedItems deletes all completed items in a list
// DELETE /api/v1/lists/:listId/items/completed
func (h *ItemHandler) DeleteCompletedItems(w http.ResponseWriter, r *http.Request) {
	_, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	listID := mux.Vars(r)["listId"]
	if listID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	count, err := h.service.DeleteCompletedItems(r.Context(), listID)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(models.BulkDeleteResponse{DeletedCount: int(count)})
}

// MoveItem moves an item to a different list
// PATCH /api/v1/lists/:listId/items/:itemId/move
func (h *ItemHandler) MoveItem(w http.ResponseWriter, r *http.Request) {
	userID, ok := api.ValidateUserID(r)
	if !ok {
		api.ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return
	}

	vars := mux.Vars(r)
	listID := vars["listId"]
	itemID := vars["itemId"]

	if listID == "" || itemID == "" {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", "List ID and Item ID are required", nil)
		return
	}

	var req models.MoveItemRequest
	if err := api.ParseJSONRequest(r, &req); err != nil {
		api.ErrorResponse(w, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	item, err := h.service.MoveItem(r.Context(), listID, itemID, req.TargetListID, req.Order, userID)
	if err != nil {
		api.ErrorHandler(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(item)
}
