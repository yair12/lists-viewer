package errs

import (
	"net/http"
	"strings"
)

// Error types
const (
	ErrorTypeVersionConflict = "version_conflict"
	ErrorTypeNotFound        = "not_found"
	ErrorTypeUnauthorized    = "unauthorized"
	ErrorTypeInternalError   = "internal_error"
	ErrorTypeValidation      = "validation_error"
)

// APIError represents a standard API error response
type APIError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// NewAPIError creates a new API error
func NewAPIError(errorType, message string) *APIError {
	return &APIError{
		Type:    errorType,
		Message: message,
		Code:    statusCodeFromType(errorType),
	}
}

// ErrorResponse formats an error for HTTP response
func ErrorResponse(errorType, message string) (*APIError, int) {
	return &APIError{
		Type:    errorType,
		Message: message,
		Code:    statusCodeFromType(errorType),
	}, statusCodeFromType(errorType)
}

// statusCodeFromType maps error types to HTTP status codes
func statusCodeFromType(errorType string) int {
	switch errorType {
	case ErrorTypeVersionConflict:
		return http.StatusConflict
	case ErrorTypeNotFound:
		return http.StatusNotFound
	case ErrorTypeUnauthorized:
		return http.StatusUnauthorized
	case ErrorTypeValidation:
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

// ErrorHandler determines the appropriate error response
func ErrorHandler(err error) (string, string) {
	if err == nil {
		return "", ""
	}

	errMsg := err.Error()

	// Check for specific error patterns
	if strings.Contains(errMsg, "not found") {
		return ErrorTypeNotFound, "The requested resource was not found"
	}
	if strings.Contains(errMsg, "version") {
		return ErrorTypeVersionConflict, "Resource was modified since you last read it. Please refresh and try again."
	}
	if strings.Contains(errMsg, "unauthorized") {
		return ErrorTypeUnauthorized, "You are not authorized to perform this action"
	}
	if strings.Contains(errMsg, "validation") {
		return ErrorTypeValidation, errMsg
	}

	return ErrorTypeInternalError, "An internal error occurred"
}

// ValidateUserID validates that a user ID is present
func ValidateUserID(userID string) bool {
	return userID != "" && len(userID) > 0
}
