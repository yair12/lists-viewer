package repository

import (
	"context"
	"errors"

	"github.com/yair12/lists-viewer/server/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// UserRepositoryImpl implements UserRepository
type UserRepositoryImpl struct {
	collection *mongo.Collection
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *mongo.Database) UserRepository {
	return &UserRepositoryImpl{
		collection: db.Collection("users"),
	}
}

// Create creates a new user
func (r *UserRepositoryImpl) Create(ctx context.Context, user *models.User) error {
	opts := options.InsertOne().SetBypassDocumentValidation(false)
	_, err := r.collection.InsertOne(ctx, user, opts)
	return err
}

// GetByUsername retrieves a user by username
func (r *UserRepositoryImpl) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(ctx, bson.M{"username": username}).Decode(&user)

	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

// Update updates an existing user
func (r *UserRepositoryImpl) Update(ctx context.Context, user *models.User) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"username": user.Username},
		bson.M{
			"$set": user,
		},
	)
	return err
}
