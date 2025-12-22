package service

import (
	"context"
	"fmt"
	"log"
	"math/rand"

	"github.com/google/uuid"
	"github.com/yair12/lists-viewer/server/internal/models"
	"github.com/yair12/lists-viewer/server/internal/repository"
)

// UserService handles business logic for users
type UserService struct {
	repo *repository.Repositories
}

// NewUserService creates a new user service
func NewUserService(repo *repository.Repositories) *UserService {
	return &UserService{repo: repo}
}

// InitUser initializes or creates a user
func (s *UserService) InitUser(ctx context.Context, req *models.InitUserRequest) (*models.UserResponse, error) {
	log.Printf("[SERVICE_INIT_USER] Initializing user: username=%s", req.Username)
	// Check if user exists
	existingUser, err := s.repo.User.GetByUsername(ctx, req.Username)
	if err != nil {
		log.Printf("[SERVICE_INIT_USER] Error checking existing user: username=%s, error=%v", req.Username, err)
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if existingUser != nil {
		log.Printf("[SERVICE_INIT_USER] User already exists: username=%s, uuid=%s", req.Username, existingUser.UUID)
		return s.mapUserToResponse(existingUser), nil
	}

	// Create new user
	user := &models.User{
		UUID:     uuid.New().String(),
		Username: req.Username,
		IconID:   req.IconID,
		Color:    s.generateColor(),
		Preferences: models.UserPreferences{
			Theme:    "dark",
			Language: "en",
		},
	}

	log.Printf("[SERVICE_INIT_USER] Creating new user: username=%s, uuid=%s", user.Username, user.UUID)
	if err := s.repo.User.Create(ctx, user); err != nil {
		log.Printf("[SERVICE_INIT_USER] Failed to create user: username=%s, error=%v", user.Username, err)
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	log.Printf("[SERVICE_INIT_USER] Successfully created user: username=%s, uuid=%s", user.Username, user.UUID)
	return s.mapUserToResponse(user), nil
}

// GetUser retrieves a user by username
func (s *UserService) GetUser(ctx context.Context, username string) (*models.UserResponse, error) {
	user, err := s.repo.User.GetByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	return s.mapUserToResponse(user), nil
}

// generateColor generates a random color for the user
func (s *UserService) generateColor() string {
	colors := []string{
		"#FF5733", "#33FF57", "#3357FF", "#F0FF33",
		"#FF33F5", "#33F5FF", "#FF9933", "#9933FF",
		"#33FF99", "#FF3366", "#66FF33", "#FF6633",
	}
	return colors[rand.Intn(len(colors))]
}

// mapUserToResponse converts a User model to a UserResponse
func (s *UserService) mapUserToResponse(user *models.User) *models.UserResponse {
	return &models.UserResponse{
		ID:       user.UUID,
		Username: user.Username,
		IconID:   user.IconID,
		Color:    user.Color,
	}
}

// GetAvailableIcons returns the list of available icons
func (s *UserService) GetAvailableIcons() []models.Icon {
	return []models.Icon{
		{ID: "icon1", Name: "Avatar 1", URL: "/icons/avatar1.png"},
		{ID: "icon2", Name: "Avatar 2", URL: "/icons/avatar2.png"},
		{ID: "icon3", Name: "Avatar 3", URL: "/icons/avatar3.png"},
		{ID: "icon4", Name: "Avatar 4", URL: "/icons/avatar4.png"},
		{ID: "icon5", Name: "Avatar 5", URL: "/icons/avatar5.png"},
	}
}
