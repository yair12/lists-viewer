package service

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/yair12/lists-viewer/server/internal/models"
	"github.com/yair12/lists-viewer/server/internal/repository"
)

// ListService handles business logic for lists
type ListService struct {
	repo *repository.Repositories
}

// NewListService creates a new list service
func NewListService(repo *repository.Repositories) *ListService {
	return &ListService{repo: repo}
}

// CreateList creates a new list
func (s *ListService) CreateList(ctx context.Context, req *models.CreateListRequest, userID string) (*models.ListResponse, error) {
	list := &models.List{
		UUID:        uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,
		UserID:      userID,
		CreatedBy:   userID,
		UpdatedBy:   userID,
	}

	log.Printf("[SERVICE_CREATE_LIST] Creating list: uuid=%s, name=%s, color=%s, userID=%s", list.UUID, list.Name, list.Color, userID)
	if err := s.repo.List.Create(ctx, list); err != nil {
		log.Printf("[SERVICE_CREATE_LIST] Failed to create list: uuid=%s, error=%v", list.UUID, err)
		return nil, fmt.Errorf("failed to create list: %w", err)
	}

	log.Printf("[SERVICE_CREATE_LIST] Successfully created list: uuid=%s", list.UUID)
	return s.mapListToResponse(list), nil
}

// GetList retrieves a list by ID
func (s *ListService) GetList(ctx context.Context, listID string, userID string) (*models.ListResponse, error) {
	list, err := s.repo.List.GetByID(ctx, listID, userID)
	if err != nil {
		log.Printf("[SERVICE_GET_LIST] Error retrieving list: listID=%s, userID=%s, error=%v", listID, userID, err)
		return nil, fmt.Errorf("failed to get list: %w", err)
	}

	if list == nil {
		log.Printf("[SERVICE_GET_LIST] List not found: listID=%s, userID=%s", listID, userID)
		return nil, fmt.Errorf("list not found")
	}

	return s.mapListToResponse(list), nil
}

// GetAllLists retrieves all lists for a user
func (s *ListService) GetAllLists(ctx context.Context, userID string) ([]models.ListResponse, error) {
	lists, err := s.repo.List.GetAll(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get lists: %w", err)
	}

	responses := make([]models.ListResponse, len(lists))
	for i, list := range lists {
		responses[i] = *s.mapListToResponse(&list)
	}

	return responses, nil
}

// UpdateList updates a list
func (s *ListService) UpdateList(ctx context.Context, listID string, req *models.UpdateListRequest, userID string) (*models.ListResponse, error) {
	log.Printf("[SERVICE_UPDATE_LIST] Updating list: listID=%s, userID=%s, version=%d, color=%s", listID, userID, req.Version, req.Color)
	// Get existing list
	existingList, err := s.repo.List.GetByID(ctx, listID, userID)
	if err != nil {
		log.Printf("[SERVICE_UPDATE_LIST] Error retrieving list: listID=%s, error=%v", listID, err)
		return nil, fmt.Errorf("failed to get list: %w", err)
	}

	if existingList == nil {
		log.Printf("[SERVICE_UPDATE_LIST] List not found: listID=%s", listID)
		return nil, fmt.Errorf("list not found")
	}

	// Check version
	if existingList.Version != req.Version {
		log.Printf("[SERVICE_UPDATE_LIST] Version conflict: listID=%s, requested=%d, current=%d", listID, req.Version, existingList.Version)
		return nil, fmt.Errorf("version_conflict")
	}

	// Update fields
	log.Printf("[SERVICE_UPDATE_LIST] Before update - Name: %s, Color: %s", existingList.Name, existingList.Color)
	existingList.Name = req.Name
	existingList.Description = req.Description
	existingList.Color = req.Color
	existingList.UpdatedBy = userID
	log.Printf("[SERVICE_UPDATE_LIST] After update - Name: %s, Color: %s", existingList.Name, existingList.Color)

	if err := s.repo.List.Update(ctx, existingList); err != nil {
		log.Printf("[SERVICE_UPDATE_LIST] Failed to update list: listID=%s, error=%v", listID, err)
		return nil, fmt.Errorf("failed to update list: %w", err)
	}

	log.Printf("[SERVICE_UPDATE_LIST] Successfully updated list: listID=%s, new_version=%d", listID, existingList.Version)
	return s.mapListToResponse(existingList), nil
}

// DeleteList deletes a list
func (s *ListService) DeleteList(ctx context.Context, listID string, userID string, version int32) error {
	log.Printf("[SERVICE_DELETE_LIST] Deleting list: listID=%s, userID=%s, version=%d", listID, userID, version)
	// Delete all items in the list first
	if err := s.repo.Item.DeleteByListID(ctx, listID); err != nil {
		log.Printf("[SERVICE_DELETE_LIST] Failed to delete list items: listID=%s, error=%v", listID, err)
		return fmt.Errorf("failed to delete list items: %w", err)
	}

	// Delete the list
	if err := s.repo.List.Delete(ctx, listID, userID, version); err != nil {
		log.Printf("[SERVICE_DELETE_LIST] Failed to delete list: listID=%s, error=%v", listID, err)
		return fmt.Errorf("failed to delete list: %w", err)
	}

	log.Printf("[SERVICE_DELETE_LIST] Successfully deleted list: listID=%s", listID)
	return nil
}

// mapListToResponse converts a List model to a ListResponse
func (s *ListService) mapListToResponse(list *models.List) *models.ListResponse {
	return &models.ListResponse{
		ID:                 list.UUID,
		Name:               list.Name,
		Description:        list.Description,
		Color:              list.Color,
		CreatedAt:          list.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:          list.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		CreatedBy:          list.CreatedBy,
		UpdatedBy:          list.UpdatedBy,
		Version:            list.Version,
		ItemCount:          list.ItemCount,
		CompletedItemCount: list.CompletedItemCount,
	}
}
