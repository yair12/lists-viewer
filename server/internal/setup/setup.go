package setup

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/yair12/lists-viewer/server/internal/api"
	"github.com/yair12/lists-viewer/server/internal/api/handler"
	"github.com/yair12/lists-viewer/server/internal/repository"
	"github.com/yair12/lists-viewer/server/internal/service"
)

// SetupRouter initializes and configures the Gin router with all handlers
func SetupRouter(dbClient *mongo.Client) *gin.Engine {
	router := gin.Default()

	// CORS middleware
	router.Use(api.CorsMiddleware())

	// Get database
	db := dbClient.Database("lists_viewer")

	// Initialize repositories
	repos := repository.NewRepositories(db)

	// Initialize services
	listService := service.NewListService(repos)
	itemService := service.NewItemService(repos)
	userService := service.NewUserService(repos)
	healthService := service.NewHealthService(dbClient)

	// Initialize handlers
	healthHandler := handler.NewHealthHandler(healthService)
	listHandler := handler.NewListHandler(listService)
	itemHandler := handler.NewItemHandler(itemService)
	userHandler := handler.NewUserHandler(userService)

	// Health check endpoints
	router.GET("/health/live", healthHandler.LivenessProbe)
	router.GET("/health/ready", healthHandler.ReadinessProbe)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Health endpoints
		v1.GET("/health", healthHandler.LivenessProbe)

		// User/Icon endpoints
		v1.POST("/users/init", userHandler.InitUser)
		v1.GET("/icons", userHandler.GetIcons)

		// List endpoints
		v1.GET("/lists", listHandler.GetAllLists)
		v1.POST("/lists", listHandler.CreateList)
		v1.GET("/lists/:id", listHandler.GetList)
		v1.PUT("/lists/:id", listHandler.UpdateList)
		v1.DELETE("/lists/:id", listHandler.DeleteList)

		// Item endpoints
		v1.GET("/lists/:listId/items", itemHandler.GetItemsByList)
		v1.POST("/lists/:listId/items", itemHandler.CreateItem)
		v1.GET("/lists/:listId/items/:itemId", itemHandler.GetItem)
		v1.PUT("/lists/:listId/items/:itemId", itemHandler.UpdateItem)
		v1.DELETE("/lists/:listId/items/:itemId", itemHandler.DeleteItem)

		// Item reorder and bulk operations
		v1.PATCH("/lists/:listId/items/reorder", itemHandler.ReorderItems)
		v1.PATCH("/lists/:listId/items/complete", itemHandler.BulkCompleteItems)
		v1.DELETE("/lists/:listId/items", itemHandler.BulkDeleteItems)
		v1.DELETE("/lists/:listId/items/completed", itemHandler.DeleteCompletedItems)

		// Item move endpoint
		v1.PATCH("/lists/:sourceListId/items/:itemId/move", itemHandler.MoveItem)
	}

	// Serve static files (to be implemented in later phases)
	// router.Static("/", "./public")

	return router
}
