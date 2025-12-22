package repository

import (
	"context"
	"errors"
	"time"

	"github.com/yair12/lists-viewer/server/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ListRepositoryImpl implements ListRepository
type ListRepositoryImpl struct {
	collection *mongo.Collection
}

// NewListRepository creates a new list repository
func NewListRepository(db *mongo.Database) ListRepository {
	return &ListRepositoryImpl{
		collection: db.Collection("lists"),
	}
}

// Create creates a new list
func (r *ListRepositoryImpl) Create(ctx context.Context, list *models.List) error {
	list.CreatedAt = time.Now()
	list.UpdatedAt = time.Now()
	list.Version = 1
	list.ItemCount = 0
	list.CompletedItemCount = 0

	result, err := r.collection.InsertOne(ctx, list)
	if err != nil {
		return err
	}

	list.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetByID retrieves a list by ID
func (r *ListRepositoryImpl) GetByID(ctx context.Context, uuid string, userID string) (*models.List, error) {
	var list models.List
	err := r.collection.FindOne(ctx, bson.M{"uuid": uuid, "userId": userID}).Decode(&list)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &list, nil
}

// GetAll retrieves all lists for a user
func (r *ListRepositoryImpl) GetAll(ctx context.Context, userID string) ([]models.List, error) {
	cursor, err := r.collection.Find(ctx, bson.M{
		"userId":   userID,
		"archived": false,
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var lists []models.List
	if err = cursor.All(ctx, &lists); err != nil {
		return nil, err
	}

	if lists == nil {
		lists = []models.List{}
	}
	return lists, nil
}

// Update updates an existing list (with optimistic locking)
func (r *ListRepositoryImpl) Update(ctx context.Context, list *models.List) error {
	list.UpdatedAt = time.Now()

	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"uuid":    list.UUID,
			"userId":  list.UserID,
			"version": list.Version,
		},
		bson.M{
			"$set": bson.M{
				"name":        list.Name,
				"description": list.Description,
				"updatedAt":   list.UpdatedAt,
				"updatedBy":   list.UpdatedBy,
				"version":     list.Version + 1,
			},
		},
	)

	if err != nil {
		return err
	}

	if result.ModifiedCount == 0 {
		return errors.New("version_conflict")
	}

	list.Version = list.Version + 1
	return nil
}

// Delete deletes a list (with optimistic locking)
func (r *ListRepositoryImpl) Delete(ctx context.Context, uuid string, userID string, version int32) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{
		"uuid":    uuid,
		"userId":  userID,
		"version": version,
	})

	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return errors.New("version_conflict")
	}

	return nil
}

// UpdateItemCounts updates the denormalized item counts for a list
func (r *ListRepositoryImpl) UpdateItemCounts(ctx context.Context, listID string) error {
	// This will be implemented when we have item repository ready
	// It will count items in the items collection
	return nil
}
