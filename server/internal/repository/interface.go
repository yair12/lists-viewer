package repository

import (
	"context"

	"github.com/yair12/lists-viewer/server/internal/models"
	"go.mongodb.org/mongo-driver/mongo"
)

// ListRepository defines methods for list operations
type ListRepository interface {
	Create(ctx context.Context, list *models.List) error
	GetByID(ctx context.Context, uuid string, userID string) (*models.List, error)
	GetAll(ctx context.Context, userID string) ([]models.List, error)
	Update(ctx context.Context, list *models.List) error
	Delete(ctx context.Context, uuid string, userID string, version int32) error
	UpdateItemCounts(ctx context.Context, listID string) error
}

// ItemRepository defines methods for item operations
type ItemRepository interface {
	Create(ctx context.Context, item *models.Item) error
	GetByID(ctx context.Context, listID string, itemID string) (*models.Item, error)
	GetByListID(ctx context.Context, listID string, includeArchived bool) ([]models.Item, error)
	Update(ctx context.Context, item *models.Item) error
	Delete(ctx context.Context, listID string, itemID string, userID string, version int32) error
	DeleteByListID(ctx context.Context, listID string) error
	DeleteCompletedByListID(ctx context.Context, listID string) error
	BulkDelete(ctx context.Context, listID string, itemIDs []string) error
	BulkComplete(ctx context.Context, listID string, itemIDs []string, updatedBy string) ([]models.Item, error)
	UpdateOrder(ctx context.Context, listID string, items []models.Item) error
	Move(ctx context.Context, sourceListID string, targetListID string, itemID string, newOrder int32) (*models.Item, error)
	IncrementVersion(ctx context.Context, listID string, itemID string) error
	UpdateItemCounts(ctx context.Context, listID string) error
}

// UserRepository defines methods for user operations
type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	GetByUsername(ctx context.Context, username string) (*models.User, error)
	Update(ctx context.Context, user *models.User) error
}

// Repositories holds all repository instances
type Repositories struct {
	List ListRepository
	Item ItemRepository
	User UserRepository
}

// NewRepositories creates new repository instances
func NewRepositories(db *mongo.Database) *Repositories {
	return &Repositories{
		List: NewListRepository(db),
		Item: NewItemRepository(db),
		User: NewUserRepository(db),
	}
}
