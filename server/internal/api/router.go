package api

import (
	"github.com/gin-gonic/gin"
)

// SetupRouter is deprecated - use setup.SetupRouter instead
// This is kept for backwards compatibility
func SetupRouter(dbClient interface{}) *gin.Engine {
	// This should not be called directly anymore
	// Import setup package and use setup.SetupRouter instead
	return gin.Default()
}

func CorsMiddleware() gin.HandlerFunc {
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
