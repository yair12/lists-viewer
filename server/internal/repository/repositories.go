package repository

import "go.mongodb.org/mongo-driver/mongo"

// Repositories holds all repository implementations
type Repositories struct {
	List ListRepository
	Item ItemRepository
	User UserRepository
}

// NewRepositories creates and initializes all repositories
func NewRepositories(db *mongo.Database) *Repositories {
	return &Repositories{
		List: NewListRepository(db),
		Item: NewItemRepository(db),
		User: NewUserRepository(db),
	}
}
