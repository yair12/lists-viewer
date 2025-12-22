package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/yair12/lists-viewer/server/internal/models"
)

// ErrorResponse sends an error response
func ErrorResponse(w http.ResponseWriter, statusCode int, errCode string, message string, details interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(models.APIError{
		Error:   errCode,
		Message: message,
		Details: details,
	})
}

// ErrorHandler handles different error types
func ErrorHandler(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}

	switch {
	case errors.Is(err, errors.New("version_conflict")):
		ErrorResponse(w, http.StatusConflict, "version_conflict", "Resource was modified by another user", nil)
	case errors.Is(err, errors.New("list not found")):
		ErrorResponse(w, http.StatusNotFound, "not_found", "List not found", nil)
	case errors.Is(err, errors.New("item not found")):
		ErrorResponse(w, http.StatusNotFound, "not_found", "Item not found", nil)
	case errors.Is(err, errors.New("user not found")):
		ErrorResponse(w, http.StatusNotFound, "not_found", "User not found", nil)
	case errors.Is(err, errors.New("unauthorized")):
		ErrorResponse(w, http.StatusUnauthorized, "unauthorized", "Missing or invalid user ID", nil)
	default:
		ErrorResponse(w, http.StatusInternalServerError, "internal_error", "An internal error occurred", nil)
	}
}

// ValidateUserID validates that user ID is present in headers
func ValidateUserID(r *http.Request) (string, bool) {
	userID := r.Header.Get("X-User-Id")
	return userID, userID != ""
}

// ParseJSONRequest parses JSON request body into target struct
func ParseJSONRequest(r *http.Request, target interface{}) error {
	if r.Body == nil {
		return errors.New("request body is nil")
	}
	return json.NewDecoder(r.Body).Decode(target)
}
