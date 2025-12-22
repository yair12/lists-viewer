package api

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/yair12/lists-viewer/server/internal/api/handler"
)

func SetupRouter(dbClient *mongo.Client) *gin.Engine {
	router := gin.Default()

	// CORS middleware
	router.Use(corsMiddleware())

	// Health check endpoints
	healthHandler := handler.NewHealthHandler(dbClient)
	router.GET("/health/live", healthHandler.LivenessProbe)
	router.GET("/health/ready", healthHandler.ReadinessProbe)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Health endpoints
		v1.GET("/health", healthHandler.LivenessProbe)

		// List endpoints (to be implemented)
		// lists := v1.Group("/lists")
		// {
		// 	lists.GET("", listHandler.GetAllLists)
		// 	lists.POST("", listHandler.CreateList)
		// 	lists.GET("/:id", listHandler.GetListByID)
		// 	lists.PUT("/:id", listHandler.UpdateList)
		// 	lists.DELETE("/:id", listHandler.DeleteList)
		// }
	}

	// Serve static files (to be implemented)
	// router.Static("/", "./public")

	return router
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-User-Id")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
