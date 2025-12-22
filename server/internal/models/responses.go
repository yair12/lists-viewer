package models

// APIError represents a standard API error response
type APIError struct {
	Error   string      `json:"error"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// ListResponse represents a response containing a single list
type ListResponse struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Color              string `json:"color"`
	CreatedAt          string `json:"createdAt"`
	UpdatedAt          string `json:"updatedAt"`
	CreatedBy          string `json:"createdBy"`
	UpdatedBy          string `json:"updatedBy"`
	Version            int32  `json:"version"`
	ItemCount          int32  `json:"itemCount"`
	CompletedItemCount int32  `json:"completedItemCount"`
}

// ListsResponse represents a response containing multiple lists
type ListsResponse struct {
	Data []ListResponse `json:"data"`
}

// ItemResponse represents a response containing a single item
type ItemResponse struct {
	ID                 string `json:"id"`
	ListID             string `json:"listId"`
	Type               string `json:"type"`
	Name               string `json:"name"`
	Completed          bool   `json:"completed"`
	CreatedAt          string `json:"createdAt"`
	UpdatedAt          string `json:"updatedAt"`
	CreatedBy          string `json:"createdBy"`
	UpdatedBy          string `json:"updatedBy"`
	Version            int32  `json:"version"`
	Order              int32  `json:"order"`
	Quantity           *int32 `json:"quantity,omitempty"`
	QuantityType       string `json:"quantityType,omitempty"`
	UserIconID         string `json:"userIconId"`
	Description        string `json:"description,omitempty"`
	ItemCount          int32  `json:"itemCount,omitempty"`
	CompletedItemCount int32  `json:"completedItemCount,omitempty"`
}

// ItemsResponse represents a response containing multiple items
type ItemsResponse struct {
	Data []ItemResponse `json:"data"`
}

// UserResponse represents a response containing user info
type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	IconID   string `json:"iconId"`
	Color    string `json:"color"`
}

// IconsResponse represents a response containing available icons
type IconsResponse struct {
	Data []Icon `json:"data"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database,omitempty"`
}

// BulkCompleteResponse represents a response from bulk complete operation
type BulkCompleteResponse struct {
	CompletedCount int            `json:"completedCount"`
	Data           []ItemResponse `json:"data"`
}

// BulkDeleteResponse represents a response from bulk delete operation
type BulkDeleteResponse struct {
	DeletedCount int `json:"deletedCount"`
}

// ReorderResponse represents a response from reorder operation
type ReorderResponse struct {
	Data []ReorderItem `json:"data"`
}
