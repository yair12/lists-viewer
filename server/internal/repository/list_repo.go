package repository

import (
	"context"
	"errors"
	"log"
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

	log.Printf("[REPO_CREATE_LIST] Creating list: uuid=%s, name=%s", list.UUID, list.Name)
	result, err := r.collection.InsertOne(ctx, list)
	if err != nil {
		log.Printf("[REPO_CREATE_LIST] Failed to insert list: uuid=%s, error=%v", list.UUID, err)
		return err
	}

	list.ID = result.InsertedID.(primitive.ObjectID)
	log.Printf("[REPO_CREATE_LIST] Successfully created list: uuid=%s, _id=%s", list.UUID, list.ID.Hex())
	return nil
}

// GetByID retrieves a list by ID
func (r *ListRepositoryImpl) GetByID(ctx context.Context, uuid string, userID string) (*models.List, error) {
	var list models.List
	err := r.collection.FindOne(ctx, bson.M{"uuid": uuid}).Decode(&list)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			log.Printf("[REPO_GET_LIST] List not found: uuid=%s", uuid)
			return nil, nil
		}
		log.Printf("[REPO_GET_LIST] Database error: uuid=%s, error=%v", uuid, err)
		return nil, err
	}
	return &list, nil
}

// GetAll retrieves all lists for a user
func (r *ListRepositoryImpl) GetAll(ctx context.Context, userID string) ([]models.List, error) {
	cursor, err := r.collection.Find(ctx, bson.M{
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

	log.Printf("[REPO_UPDATE_LIST] Updating list: uuid=%s, version=%d", list.UUID, list.Version)
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
		log.Printf("[REPO_UPDATE_LIST] Database error: uuid=%s, error=%v", list.UUID, err)
		return err
	}

	if result.ModifiedCount == 0 {
		log.Printf("[REPO_UPDATE_LIST] Version conflict: uuid=%s, version=%d", list.UUID, list.Version)
		return errors.New("version_conflict")
	}

	list.Version = list.Version + 1
	log.Printf("[REPO_UPDATE_LIST] Successfully updated list: uuid=%s, new_version=%d", list.UUID, list.Version)
	return nil
}

// Delete deletes a list (with optimistic locking)
// Idempotent - returns success even if list doesn't exist
func (r *ListRepositoryImpl) Delete(ctx context.Context, uuid string, userID string, version int32) error {
	// Atomic delete with version check in single statement
	result, err := r.collection.DeleteOne(ctx, bson.M{
		"uuid":    uuid,
		"version": version,
	})

	if err != nil {
		return err
	}

	// If nothing was deleted, check if it's because version mismatch or doesn't exist
	if result.DeletedCount == 0 {
		// Check if the list exists with different version
		var existingList models.List
		err := r.collection.FindOne(ctx, bson.M{"uuid": uuid}).Decode(&existingList)
		if err == nil {
			// List exists but version doesn't match - conflict
			log.Printf("[REPO_DELETE_LIST] Version conflict detected for uuid=%s, requested_version=%d, current_version=%d", uuid, version, existingList.Version)
			return errors.New("version_conflict")
		}
		// Check if error is "no documents" which means list doesn't exist
		if err == mongo.ErrNoDocuments {
			// List doesn't exist - idempotent success
			log.Printf("[REPO_DELETE_LIST] List not found (idempotent delete): uuid=%s", uuid)
			return nil
		}
		// Some other database error
		log.Printf("[REPO_DELETE_LIST] FindOne error after failed delete: uuid=%s, error=%v", uuid, err)
		return err
	}

	return nil
}

// UpdateItemCounts updates the denormalized item counts for a list
func (r *ListRepositoryImpl) UpdateItemCounts(ctx context.Context, listID string) error {
	// This will be implemented when we have item repository ready
	// It will count items in the items collection
	return nil
}
