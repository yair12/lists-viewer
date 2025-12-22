package repository

import (
	"context"
	"errors"
	"time"

	"github.com/yair12/lists-viewer/server/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// ItemRepositoryImpl implements ItemRepository
type ItemRepositoryImpl struct {
	collection *mongo.Collection
}

// NewItemRepository creates a new item repository
func NewItemRepository(db *mongo.Database) ItemRepository {
	return &ItemRepositoryImpl{
		collection: db.Collection("items"),
	}
}

// Create creates a new item
func (r *ItemRepositoryImpl) Create(ctx context.Context, item *models.Item) error {
	item.CreatedAt = time.Now()
	item.UpdatedAt = time.Now()
	item.Version = 1
	item.Archived = false
	if item.Type == "item" {
		item.Completed = false
	}

	_, err := r.collection.InsertOne(ctx, item)
	return err
}

// GetByID retrieves an item by ID
func (r *ItemRepositoryImpl) GetByID(ctx context.Context, listID string, itemID string) (*models.Item, error) {
	var item models.Item
	err := r.collection.FindOne(ctx, bson.M{
		"uuid":   itemID,
		"listId": listID,
	}).Decode(&item)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

// GetByListID retrieves all items in a list
func (r *ItemRepositoryImpl) GetByListID(ctx context.Context, listID string, includeArchived bool) ([]models.Item, error) {
	filter := bson.M{"listId": listID}
	if !includeArchived {
		filter["archived"] = false
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var items []models.Item
	if err = cursor.All(ctx, &items); err != nil {
		return nil, err
	}

	if items == nil {
		items = []models.Item{}
	}
	return items, nil
}

// Update updates an existing item (with optimistic locking)
func (r *ItemRepositoryImpl) Update(ctx context.Context, item *models.Item) error {
	item.UpdatedAt = time.Now()

	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"uuid":    item.UUID,
			"listId":  item.ListID,
			"version": item.Version,
		},
		bson.M{
			"$set": bson.M{
				"name":               item.Name,
				"completed":          item.Completed,
				"quantity":           item.Quantity,
				"quantityType":       item.QuantityType,
				"order":              item.Order,
				"userIconId":         item.UserIconID,
				"updatedAt":          item.UpdatedAt,
				"updatedBy":          item.UpdatedBy,
				"version":            item.Version + 1,
				"description":        item.Description,
				"itemCount":          item.ItemCount,
				"completedItemCount": item.CompletedItemCount,
			},
		},
	)

	if err != nil {
		return err
	}

	if result.ModifiedCount == 0 {
		return errors.New("version_conflict")
	}

	item.Version = item.Version + 1
	return nil
}

// Delete deletes an item (with optimistic locking)
func (r *ItemRepositoryImpl) Delete(ctx context.Context, listID string, itemID string, userID string, version int32) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{
		"uuid":    itemID,
		"listId":  listID,
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

// DeleteByListID deletes all items in a list
func (r *ItemRepositoryImpl) DeleteByListID(ctx context.Context, listID string) error {
	_, err := r.collection.DeleteMany(ctx, bson.M{"listId": listID})
	return err
}

// DeleteCompletedByListID deletes all completed items in a list
func (r *ItemRepositoryImpl) DeleteCompletedByListID(ctx context.Context, listID string) error {
	result, err := r.collection.DeleteMany(ctx, bson.M{
		"listId":    listID,
		"type":      "item",
		"completed": true,
	})

	if err != nil {
		return err
	}

	_ = result // silence unused variable
	return nil
}

// BulkDelete deletes multiple items
func (r *ItemRepositoryImpl) BulkDelete(ctx context.Context, listID string, itemIDs []string) error {
	_, err := r.collection.DeleteMany(ctx, bson.M{
		"listId": listID,
		"uuid": bson.M{
			"$in": itemIDs,
		},
	})
	return err
}

// BulkComplete completes multiple items
func (r *ItemRepositoryImpl) BulkComplete(ctx context.Context, listID string, itemIDs []string, updatedBy string) ([]models.Item, error) {
	now := time.Now()

	result, err := r.collection.UpdateMany(
		ctx,
		bson.M{
			"listId": listID,
			"type":   "item",
			"uuid": bson.M{
				"$in": itemIDs,
			},
		},
		bson.M{
			"$set": bson.M{
				"completed": true,
				"updatedAt": now,
				"updatedBy": updatedBy,
			},
			"$inc": bson.M{
				"version": 1,
			},
		},
	)

	if err != nil {
		return nil, err
	}

	_ = result // silence unused variable

	// Retrieve updated items
	cursor, err := r.collection.Find(ctx, bson.M{
		"listId": listID,
		"uuid": bson.M{
			"$in": itemIDs,
		},
	})

	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var items []models.Item
	if err = cursor.All(ctx, &items); err != nil {
		return nil, err
	}

	return items, nil
}

// UpdateOrder updates the order of items
func (r *ItemRepositoryImpl) UpdateOrder(ctx context.Context, listID string, items []models.Item) error {
	for _, item := range items {
		_, err := r.collection.UpdateOne(
			ctx,
			bson.M{
				"uuid":   item.UUID,
				"listId": listID,
			},
			bson.M{
				"$set": bson.M{
					"order": item.Order,
				},
			},
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// Move moves an item to a different list
func (r *ItemRepositoryImpl) Move(ctx context.Context, sourceListID string, targetListID string, itemID string, newOrder int32) (*models.Item, error) {
	result, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"uuid":   itemID,
			"listId": sourceListID,
		},
		bson.M{
			"$set": bson.M{
				"listId":    targetListID,
				"order":     newOrder,
				"updatedAt": time.Now(),
			},
		},
	)

	if err != nil {
		return nil, err
	}

	if result.ModifiedCount == 0 {
		return nil, errors.New("item not found")
	}

	return r.GetByID(ctx, targetListID, itemID)
}

// IncrementVersion increments the version of an item
func (r *ItemRepositoryImpl) IncrementVersion(ctx context.Context, listID string, itemID string) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{
			"uuid":   itemID,
			"listId": listID,
		},
		bson.M{
			"$inc": bson.M{
				"version": 1,
			},
		},
	)
	return err
}

// UpdateItemCounts updates denormalized item counts
func (r *ItemRepositoryImpl) UpdateItemCounts(ctx context.Context, listID string) error {
	// Count regular items
	regularCount, err := r.collection.CountDocuments(ctx, bson.M{
		"listId": listID,
		"type":   "item",
	})

	if err != nil {
		return err
	}

	// Count completed items
	completedCount, err := r.collection.CountDocuments(ctx, bson.M{
		"listId":    listID,
		"type":      "item",
		"completed": true,
	})

	if err != nil {
		return err
	}

	// Update parent list (if this is a nested list)
	_, err = r.collection.UpdateOne(
		ctx,
		bson.M{
			"uuid": listID,
			"type": "list",
		},
		bson.M{
			"$set": bson.M{
				"itemCount":          int32(regularCount),
				"completedItemCount": int32(completedCount),
			},
		},
	)

	return err
}
