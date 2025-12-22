package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
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
func (h *ItemHandler) GetItemsByList(c *gin.Context) {
	_, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	includeArchived := false
	if archived := c.Query("includeArchived"); archived == "true" {
		includeArchived = true
	}

	items, err := h.service.GetItemsByList(c.Request.Context(), listID, includeArchived)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, models.ItemsResponse{Data: items})
}

// CreateItem creates a new item
// POST /api/v1/lists/:listId/items
func (h *ItemHandler) CreateItem(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	item, err := h.service.CreateItem(c.Request.Context(), listID, &req, userID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusCreated, item)
}

// GetItem retrieves a specific item
// GET /api/v1/lists/:listId/items/:itemId
func (h *ItemHandler) GetItem(c *gin.Context) {
	_, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	itemID := c.Param("itemId")

	if listID == "" || itemID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID and Item ID are required", nil)
		return
	}

	item, err := h.service.GetItem(c.Request.Context(), listID, itemID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, item)
}

// UpdateItem updates an item
// PUT /api/v1/lists/:listId/items/:itemId
func (h *ItemHandler) UpdateItem(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	itemID := c.Param("itemId")

	if listID == "" || itemID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID and Item ID are required", nil)
		return
	}

	var req models.UpdateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	item, err := h.service.UpdateItem(c.Request.Context(), listID, itemID, &req, userID)
	if err != nil {
		if err.Error() == "version_conflict" {
			api.ErrorResponse(c, http.StatusConflict, "version_conflict", "Item was modified by another user", nil)
		} else {
			api.ErrorHandler(c, err)
		}
		return
	}

	c.JSON(http.StatusOK, item)
}

// DeleteItem deletes an item
// DELETE /api/v1/lists/:listId/items/:itemId
func (h *ItemHandler) DeleteItem(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	itemID := c.Param("itemId")

	if listID == "" || itemID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID and Item ID are required", nil)
		return
	}

	var req models.DeleteItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	err := h.service.DeleteItem(c.Request.Context(), listID, itemID, userID, req.Version)
	if err != nil {
		if err.Error() == "version_conflict" {
			api.ErrorResponse(c, http.StatusConflict, "version_conflict", "Item was modified by another user", nil)
		} else {
			api.ErrorHandler(c, err)
		}
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// ReorderItems reorders items in a list
// PATCH /api/v1/lists/:listId/items/reorder
func (h *ItemHandler) ReorderItems(c *gin.Context) {
	_, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.ReorderItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	items, err := h.service.ReorderItems(c.Request.Context(), listID, req.Items)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, models.ReorderResponse{Data: items})
}

// BulkCompleteItems completes multiple items
// PATCH /api/v1/lists/:listId/items/complete
func (h *ItemHandler) BulkCompleteItems(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.BulkCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	items, err := h.service.BulkCompleteItems(c.Request.Context(), listID, req.ItemIDs, userID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, models.BulkCompleteResponse{
		CompletedCount: int(len(items)),
		Data:           items,
	})
}

// BulkDeleteItems deletes multiple items
// DELETE /api/v1/lists/:listId/items
func (h *ItemHandler) BulkDeleteItems(c *gin.Context) {
	_, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.BulkDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	count, err := h.service.BulkDeleteItems(c.Request.Context(), listID, req.ItemIDs)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, models.BulkDeleteResponse{DeletedCount: int(count)})
}

// DeleteCompletedItems deletes all completed items in a list
// DELETE /api/v1/lists/:listId/items/completed
func (h *ItemHandler) DeleteCompletedItems(c *gin.Context) {
	_, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("listId")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	count, err := h.service.DeleteCompletedItems(c.Request.Context(), listID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, models.BulkDeleteResponse{DeletedCount: int(count)})
}

// MoveItem moves an item to a different list
// PATCH /api/v1/lists/:sourceListId/items/:itemId/move
func (h *ItemHandler) MoveItem(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	sourceListID := c.Param("sourceListId")
	itemID := c.Param("itemId")

	if sourceListID == "" || itemID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "Source List ID and Item ID are required", nil)
		return
	}

	var req models.MoveItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	item, err := h.service.MoveItem(c.Request.Context(), sourceListID, itemID, req.TargetListID, req.Order, userID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, item)
}
