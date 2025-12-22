package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// List represents a todo list
type List struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UUID               string             `bson:"uuid" json:"uuid"`
	Name               string             `bson:"name" json:"name"`
	Description        string             `bson:"description" json:"description"`
	Color              string             `bson:"color" json:"color"`
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt" json:"updatedAt"`
	CreatedBy          string             `bson:"createdBy" json:"createdBy"`
	UpdatedBy          string             `bson:"updatedBy" json:"updatedBy"`
	Version            int32              `bson:"version" json:"version"`
	UserID             string             `bson:"userId" json:"userId"`
	Archived           bool               `bson:"archived" json:"archived"`
	ItemCount          int32              `bson:"itemCount" json:"itemCount"`
	CompletedItemCount int32              `bson:"completedItemCount" json:"completedItemCount"`
}

// Item represents a todo item or nested list
type Item struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UUID               string             `bson:"uuid" json:"uuid"`
	ListID             string             `bson:"listId" json:"listId"`
	Type               string             `bson:"type" json:"type"` // "item" or "list"
	Name               string             `bson:"name" json:"name"`
	Completed          bool               `bson:"completed" json:"completed"`
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt" json:"updatedAt"`
	CreatedBy          string             `bson:"createdBy" json:"createdBy"`
	UpdatedBy          string             `bson:"updatedBy" json:"updatedBy"`
	Version            int32              `bson:"version" json:"version"`
	Order              int32              `bson:"order" json:"order"`
	Quantity           *int32             `bson:"quantity,omitempty" json:"quantity,omitempty"`
	QuantityType       string             `bson:"quantityType,omitempty" json:"quantityType,omitempty"`
	UserIconID         string             `bson:"userIconId" json:"userIconId"`
	Archived           bool               `bson:"archived" json:"archived"`
	SyncStatus         string             `bson:"syncStatus" json:"syncStatus"`
	Description        string             `bson:"description,omitempty" json:"description,omitempty"` // For nested lists
	ItemCount          int32              `bson:"itemCount" json:"itemCount"`                         // For nested lists
	CompletedItemCount int32              `bson:"completedItemCount" json:"completedItemCount"`       // For nested lists
}

// User represents a user/profile
type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UUID         string             `bson:"uuid" json:"uuid"`
	Username     string             `bson:"username" json:"username"`
	IconID       string             `bson:"iconId" json:"iconId"`
	Color        string             `bson:"color" json:"color"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	LastActivity time.Time          `bson:"lastActivity" json:"lastActivity"`
	Preferences  UserPreferences    `bson:"preferences" json:"preferences"`
}

// UserPreferences stores user preferences
type UserPreferences struct {
	Theme    string `bson:"theme" json:"theme"` // "light" or "dark"
	Language string `bson:"language" json:"language"`
}

// Icon represents an available icon
type Icon struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

// CreateListRequest represents a request to create a list
type CreateListRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=255"`
	Description string `json:"description" binding:"max=500"`
	Color       string `json:"color" binding:"max=7"`
}

// UpdateListRequest represents a request to update a list
type UpdateListRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=255"`
	Description string `json:"description" binding:"max=500"`
	Color       string `json:"color" binding:"max=7"`
	Version     int32  `json:"version" binding:"required"`
}

// DeleteListRequest represents a request to delete a list
type DeleteListRequest struct {
	Version int32 `json:"version" binding:"required"`
}

// CreateItemRequest represents a request to create an item
type CreateItemRequest struct {
	Type         string `json:"type" binding:"required,oneof=item list"`
	Name         string `json:"name" binding:"required,min=1,max=255"`
	Quantity     *int32 `json:"quantity,omitempty" binding:"omitempty,gt=0"`
	QuantityType string `json:"quantityType,omitempty" binding:"max=50"`
	UserIconID   string `json:"userIconId"`
	Description  string `json:"description,omitempty" binding:"max=500"`
}

// UpdateItemRequest represents a request to update an item
type UpdateItemRequest struct {
	Name         string `json:"name" binding:"required,min=1,max=255"`
	Completed    *bool  `json:"completed,omitempty"`
	Quantity     *int32 `json:"quantity,omitempty" binding:"omitempty,gt=0"`
	QuantityType string `json:"quantityType,omitempty" binding:"max=50"`
	Order        int32  `json:"order" binding:"required"`
	Version      int32  `json:"version" binding:"required"`
	Description  string `json:"description,omitempty" binding:"max=500"`
}

// DeleteItemRequest represents a request to delete an item
type DeleteItemRequest struct {
	Version int32 `json:"version" binding:"required"`
}

// ReorderItemsRequest represents a request to reorder items
type ReorderItemsRequest struct {
	Items []ReorderItem `json:"items" binding:"required,min=1"`
}

// ReorderItem represents an item order change
type ReorderItem struct {
	ID    string `json:"id" binding:"required"`
	Order int32  `json:"order" binding:"required"`
}

// BulkCompleteRequest represents a request to complete multiple items
type BulkCompleteRequest struct {
	ItemIDs []string `json:"itemIds" binding:"required,min=1"`
}

// BulkDeleteRequest represents a request to delete multiple items
type BulkDeleteRequest struct {
	ItemIDs []string `json:"itemIds" binding:"required,min=1"`
}

// MoveItemRequest represents a request to move an item between lists
type MoveItemRequest struct {
	TargetListID string `json:"targetListId" binding:"required"`
	Order        int32  `json:"order" binding:"required"`
	Version      int32  `json:"version" binding:"required"`
}

// InitUserRequest represents a request to initialize/create a user
type InitUserRequest struct {
	Username string `json:"username" binding:"required,min=1,max=255"`
	IconID   string `json:"iconId" binding:"required"`
}
