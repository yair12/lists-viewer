package service

import (
	"context"
	"fmt"

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
		UserID:      userID,
		CreatedBy:   userID,
		UpdatedBy:   userID,
	}

	if err := s.repo.List.Create(ctx, list); err != nil {
		return nil, fmt.Errorf("failed to create list: %w", err)
	}

	return s.mapListToResponse(list), nil
}

// GetList retrieves a list by ID
func (s *ListService) GetList(ctx context.Context, listID string, userID string) (*models.ListResponse, error) {
	list, err := s.repo.List.GetByID(ctx, listID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get list: %w", err)
	}

	if list == nil {
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
	// Get existing list
	existingList, err := s.repo.List.GetByID(ctx, listID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get list: %w", err)
	}

	if existingList == nil {
		return nil, fmt.Errorf("list not found")
	}

	// Check version
	if existingList.Version != req.Version {
		return nil, fmt.Errorf("version_conflict")
	}

	// Update fields
	existingList.Name = req.Name
	existingList.Description = req.Description
	existingList.UpdatedBy = userID

	if err := s.repo.List.Update(ctx, existingList); err != nil {
		return nil, fmt.Errorf("failed to update list: %w", err)
	}

	return s.mapListToResponse(existingList), nil
}

// DeleteList deletes a list
func (s *ListService) DeleteList(ctx context.Context, listID string, userID string, version int32) error {
	// Delete all items in the list first
	if err := s.repo.Item.DeleteByListID(ctx, listID); err != nil {
		return fmt.Errorf("failed to delete list items: %w", err)
	}

	// Delete the list
	if err := s.repo.List.Delete(ctx, listID, userID, version); err != nil {
		return fmt.Errorf("failed to delete list: %w", err)
	}

	return nil
}

// mapListToResponse converts a List model to a ListResponse
func (s *ListService) mapListToResponse(list *models.List) *models.ListResponse {
	return &models.ListResponse{
		ID:                 list.UUID,
		Name:               list.Name,
		Description:        list.Description,
		CreatedAt:          list.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:          list.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		CreatedBy:          list.CreatedBy,
		UpdatedBy:          list.UpdatedBy,
		Version:            list.Version,
		ItemCount:          list.ItemCount,
		CompletedItemCount: list.CompletedItemCount,
	}
}
