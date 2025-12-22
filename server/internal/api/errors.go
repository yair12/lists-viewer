package api

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yair12/lists-viewer/server/internal/models"
)

// ErrorResponse sends an error response
func ErrorResponse(c *gin.Context, statusCode int, errCode string, message string, details interface{}) {
	c.JSON(statusCode, models.APIError{
		Error:   errCode,
		Message: message,
		Details: details,
	})
}

// ErrorHandler handles different error types
func ErrorHandler(c *gin.Context, err error) {
	if err == nil {
		return
	}

	switch {
	case errors.Is(err, errors.New("version_conflict")):
		ErrorResponse(c, http.StatusConflict, "version_conflict", "Resource was modified by another user", nil)
	case errors.Is(err, errors.New("list not found")):
		ErrorResponse(c, http.StatusNotFound, "not_found", "List not found", nil)
	case errors.Is(err, errors.New("item not found")):
		ErrorResponse(c, http.StatusNotFound, "not_found", "Item not found", nil)
	case errors.Is(err, errors.New("user not found")):
		ErrorResponse(c, http.StatusNotFound, "not_found", "User not found", nil)
	case errors.Is(err, errors.New("unauthorized")):
		ErrorResponse(c, http.StatusUnauthorized, "unauthorized", "Missing or invalid user ID", nil)
	default:
		ErrorResponse(c, http.StatusInternalServerError, "internal_error", "An internal error occurred", nil)
	}
}

// ValidateUserID validates that user ID is present in headers
func ValidateUserID(c *gin.Context) (string, bool) {
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		ErrorResponse(c, http.StatusUnauthorized, "unauthorized", "Missing X-User-Id header", nil)
		return "", false
	}
	return userID, true
}
