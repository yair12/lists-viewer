package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
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
func (h *ListHandler) GetAllLists(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	lists, err := h.service.GetAllLists(c.Request.Context(), userID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, models.ListsResponse{Data: lists})
}

// CreateList creates a new list
// POST /api/v1/lists
func (h *ListHandler) CreateList(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	var req models.CreateListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	list, err := h.service.CreateList(c.Request.Context(), &req, userID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusCreated, list)
}

// GetList retrieves a specific list by ID
// GET /api/v1/lists/:id
func (h *ListHandler) GetList(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("id")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	list, err := h.service.GetList(c.Request.Context(), listID, userID)
	if err != nil {
		api.ErrorHandler(c, err)
		return
	}

	c.JSON(http.StatusOK, list)
}

// UpdateList updates a list
// PUT /api/v1/lists/:id
func (h *ListHandler) UpdateList(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("id")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.UpdateListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	list, err := h.service.UpdateList(c.Request.Context(), listID, &req, userID)
	if err != nil {
		if err.Error() == "version_conflict" {
			api.ErrorResponse(c, http.StatusConflict, "version_conflict", "List was modified by another user", nil)
		} else {
			api.ErrorHandler(c, err)
		}
		return
	}

	c.JSON(http.StatusOK, list)
}

// DeleteList deletes a list
// DELETE /api/v1/lists/:id
func (h *ListHandler) DeleteList(c *gin.Context) {
	userID, ok := api.ValidateUserID(c)
	if !ok {
		return
	}

	listID := c.Param("id")
	if listID == "" {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", "List ID is required", nil)
		return
	}

	var req models.DeleteListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.ErrorResponse(c, http.StatusBadRequest, "validation_error", err.Error(), nil)
		return
	}

	err := h.service.DeleteList(c.Request.Context(), listID, userID, req.Version)
	if err != nil {
		if err.Error() == "version_conflict" {
			api.ErrorResponse(c, http.StatusConflict, "version_conflict", "List was modified by another user", nil)
		} else {
			api.ErrorHandler(c, err)
		}
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
