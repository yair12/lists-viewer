package service

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/yair12/lists-viewer/server/internal/models"
	"github.com/yair12/lists-viewer/server/internal/repository"
)

// ItemService handles business logic for items
type ItemService struct {
	repo *repository.Repositories
}

// NewItemService creates a new item service
func NewItemService(repo *repository.Repositories) *ItemService {
	return &ItemService{repo: repo}
}

// CreateItem creates a new item
func (s *ItemService) CreateItem(ctx context.Context, listID string, req *models.CreateItemRequest, userID string) (*models.ItemResponse, error) {
	item := &models.Item{
		UUID:       uuid.New().String(),
		ListID:     listID,
		Type:       req.Type,
		Name:       req.Name,
		CreatedBy:  userID,
		UpdatedBy:  userID,
		UserIconID: req.UserIconID,
	}

	if req.Type == "item" {
		item.Completed = false
		item.Quantity = req.Quantity
		item.QuantityType = req.QuantityType
	} else if req.Type == "list" {
		item.Description = req.Description
	}

	// Get next order value
	existingItems, err := s.repo.Item.GetByListID(ctx, listID, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	var maxOrder int32 = 0
	for _, existing := range existingItems {
		if existing.Order > maxOrder {
			maxOrder = existing.Order
		}
	}
	item.Order = maxOrder + 1

	log.Printf("[SERVICE_CREATE_ITEM] Creating item: uuid=%s, listID=%s, name=%s, type=%s, order=%d", item.UUID, listID, item.Name, item.Type, item.Order)
	if err := s.repo.Item.Create(ctx, item); err != nil {
		log.Printf("[SERVICE_CREATE_ITEM] Failed to create item: uuid=%s, error=%v", item.UUID, err)
		return nil, fmt.Errorf("failed to create item: %w", err)
	}

	log.Printf("[SERVICE_CREATE_ITEM] Successfully created item: uuid=%s", item.UUID)
	return s.mapItemToResponse(item), nil
}

// GetItem retrieves an item by ID
func (s *ItemService) GetItem(ctx context.Context, listID string, itemID string) (*models.ItemResponse, error) {
	item, err := s.repo.Item.GetByID(ctx, listID, itemID)
	if err != nil {
		return nil, fmt.Errorf("failed to get item: %w", err)
	}

	if item == nil {
		return nil, fmt.Errorf("item not found")
	}

	return s.mapItemToResponse(item), nil
}

// GetItemsByList retrieves all items in a list
func (s *ItemService) GetItemsByList(ctx context.Context, listID string, includeArchived bool) ([]models.ItemResponse, error) {
	items, err := s.repo.Item.GetByListID(ctx, listID, includeArchived)
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	responses := make([]models.ItemResponse, len(items))
	for i, item := range items {
		responses[i] = *s.mapItemToResponse(&item)
	}

	return responses, nil
}

// UpdateItem updates an item
func (s *ItemService) UpdateItem(ctx context.Context, listID string, itemID string, req *models.UpdateItemRequest, userID string) (*models.ItemResponse, error) {
	log.Printf("[SERVICE_UPDATE_ITEM] Updating item: itemID=%s, listID=%s, version=%d", itemID, listID, req.Version)
	// Get existing item
	existingItem, err := s.repo.Item.GetByID(ctx, listID, itemID)
	if err != nil {
		log.Printf("[SERVICE_UPDATE_ITEM] Error retrieving item: itemID=%s, error=%v", itemID, err)
		return nil, fmt.Errorf("failed to get item: %w", err)
	}

	if existingItem == nil {
		log.Printf("[SERVICE_UPDATE_ITEM] Item not found: itemID=%s", itemID)
		return nil, fmt.Errorf("item not found")
	}

	// Check version
	if existingItem.Version != req.Version {
		log.Printf("[SERVICE_UPDATE_ITEM] Version conflict: itemID=%s, requested=%d, current=%d", itemID, req.Version, existingItem.Version)
		return nil, fmt.Errorf("version_conflict")
	}

	// Update fields
	existingItem.Name = req.Name
	existingItem.Order = req.Order
	existingItem.UpdatedBy = userID

	if req.Completed != nil && existingItem.Type == "item" {
		existingItem.Completed = *req.Completed
	}

	if existingItem.Type == "item" {
		existingItem.Quantity = req.Quantity
		existingItem.QuantityType = req.QuantityType
	} else {
		existingItem.Description = req.Description
	}

	if err := s.repo.Item.Update(ctx, existingItem); err != nil {
		log.Printf("[SERVICE_UPDATE_ITEM] Failed to update item: itemID=%s, error=%v", itemID, err)
		return nil, fmt.Errorf("failed to update item: %w", err)
	}

	log.Printf("[SERVICE_UPDATE_ITEM] Successfully updated item: itemID=%s, new_version=%d", itemID, existingItem.Version)
	return s.mapItemToResponse(existingItem), nil
}

// DeleteItem deletes an item
func (s *ItemService) DeleteItem(ctx context.Context, listID string, itemID string, userID string, version int32) error {
	log.Printf("[SERVICE_DELETE_ITEM] Deleting item: itemID=%s, listID=%s, version=%d", itemID, listID, version)
	if err := s.repo.Item.Delete(ctx, listID, itemID, userID, version); err != nil {
		log.Printf("[SERVICE_DELETE_ITEM] Failed to delete item: itemID=%s, error=%v", itemID, err)
		return fmt.Errorf("failed to delete item: %w", err)
	}

	log.Printf("[SERVICE_DELETE_ITEM] Successfully deleted item: itemID=%s", itemID)
	return nil
}

// DeleteCompletedItems deletes all completed items in a list
func (s *ItemService) DeleteCompletedItems(ctx context.Context, listID string) (int32, error) {
	items, err := s.repo.Item.GetByListID(ctx, listID, false)
	if err != nil {
		return 0, fmt.Errorf("failed to get items: %w", err)
	}

	completedIDs := []string{}
	for _, item := range items {
		if item.Type == "item" && item.Completed {
			completedIDs = append(completedIDs, item.UUID)
		}
	}

	if len(completedIDs) == 0 {
		return 0, nil
	}

	if err := s.repo.Item.BulkDelete(ctx, listID, completedIDs); err != nil {
		return 0, fmt.Errorf("failed to delete items: %w", err)
	}

	return int32(len(completedIDs)), nil
}

// BulkCompleteItems completes multiple items
func (s *ItemService) BulkCompleteItems(ctx context.Context, listID string, itemIDs []string, userID string) ([]models.ItemResponse, error) {
	items, err := s.repo.Item.BulkComplete(ctx, listID, itemIDs, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to complete items: %w", err)
	}

	responses := make([]models.ItemResponse, len(items))
	for i, item := range items {
		responses[i] = *s.mapItemToResponse(&item)
	}

	return responses, nil
}

// BulkDeleteItems deletes multiple items
func (s *ItemService) BulkDeleteItems(ctx context.Context, listID string, itemIDs []string) (int32, error) {
	if err := s.repo.Item.BulkDelete(ctx, listID, itemIDs); err != nil {
		return 0, fmt.Errorf("failed to delete items: %w", err)
	}

	return int32(len(itemIDs)), nil
}

// ReorderItems updates the order of items
func (s *ItemService) ReorderItems(ctx context.Context, listID string, reorderReqs []models.ReorderItem) ([]models.ReorderItem, error) {
	items := make([]models.Item, len(reorderReqs))
	for i, req := range reorderReqs {
		items[i] = models.Item{
			UUID:  req.ID,
			Order: req.Order,
		}
	}

	if err := s.repo.Item.UpdateOrder(ctx, listID, items); err != nil {
		return nil, fmt.Errorf("failed to reorder items: %w", err)
	}

	return reorderReqs, nil
}

// MoveItem moves an item to a different list
func (s *ItemService) MoveItem(ctx context.Context, sourceListID string, itemID string, targetListID string, newOrder int32, userID string) (*models.ItemResponse, error) {
	movedItem, err := s.repo.Item.Move(ctx, sourceListID, targetListID, itemID, newOrder)
	if err != nil {
		return nil, fmt.Errorf("failed to move item: %w", err)
	}

	return s.mapItemToResponse(movedItem), nil
}

// mapItemToResponse converts an Item model to an ItemResponse
func (s *ItemService) mapItemToResponse(item *models.Item) *models.ItemResponse {
	return &models.ItemResponse{
		ID:                 item.UUID,
		ListID:             item.ListID,
		Type:               item.Type,
		Name:               item.Name,
		Completed:          item.Completed,
		CreatedAt:          item.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:          item.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		CreatedBy:          item.CreatedBy,
		UpdatedBy:          item.UpdatedBy,
		Version:            item.Version,
		Order:              item.Order,
		Quantity:           item.Quantity,
		QuantityType:       item.QuantityType,
		UserIconID:         item.UserIconID,
		Description:        item.Description,
		ItemCount:          item.ItemCount,
		CompletedItemCount: item.CompletedItemCount,
	}
}
