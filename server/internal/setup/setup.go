package setup

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/yair12/lists-viewer/server/internal/api"
	"github.com/yair12/lists-viewer/server/internal/api/handler"
	"github.com/yair12/lists-viewer/server/internal/repository"
	"github.com/yair12/lists-viewer/server/internal/service"
)

// SetupRouter initializes and configures the Gorilla Mux router with all handlers
func SetupRouter(dbClient *mongo.Client) http.Handler {
	log.Printf("[SETUP] Initializing router and dependencies...")
	router := mux.NewRouter()

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

	// Health check endpoints (root level)
	router.HandleFunc("/health/live", healthHandler.LivenessProbe).Methods("GET")
	router.HandleFunc("/health/ready", healthHandler.ReadinessProbe).Methods("GET")

	// API v1 routes
	api1 := router.PathPrefix("/api/v1").Subrouter()

	// Health endpoints
	api1.HandleFunc("/health", healthHandler.LivenessProbe).Methods("GET")

	// User/Icon endpoints
	api1.HandleFunc("/users/init", userHandler.InitUser).Methods("POST")
	api1.HandleFunc("/icons", userHandler.GetIcons).Methods("GET")

	// List CRUD endpoints
	api1.HandleFunc("/lists", listHandler.GetAllLists).Methods("GET")
	api1.HandleFunc("/lists", listHandler.CreateList).Methods("POST")
	api1.HandleFunc("/lists/{id}", listHandler.GetList).Methods("GET")
	api1.HandleFunc("/lists/{id}", listHandler.UpdateList).Methods("PUT")
	api1.HandleFunc("/lists/{id}", listHandler.DeleteList).Methods("DELETE")

	// Item endpoints - register static paths before dynamic {itemId} paths
	itemsRouter := api1.PathPrefix("/lists/{listId}/items").Subrouter()

	// Item bulk operations (static paths - must come first!)
	itemsRouter.HandleFunc("/reorder", itemHandler.ReorderItems).Methods("PATCH")
	itemsRouter.HandleFunc("/complete", itemHandler.BulkCompleteItems).Methods("PATCH")
	itemsRouter.HandleFunc("/completed", itemHandler.DeleteCompletedItems).Methods("DELETE")

	// Specific item operations (dynamic paths - come after static paths)
	itemsRouter.HandleFunc("/{itemId}", itemHandler.GetItem).Methods("GET")
	itemsRouter.HandleFunc("/{itemId}", itemHandler.UpdateItem).Methods("PUT")
	itemsRouter.HandleFunc("/{itemId}", itemHandler.DeleteItem).Methods("DELETE")
	itemsRouter.HandleFunc("/{itemId}/move", itemHandler.MoveItem).Methods("PATCH")

	// General item collection endpoints (no path suffix)
	itemsRouter.HandleFunc("", itemHandler.GetItemsByList).Methods("GET")
	itemsRouter.HandleFunc("", itemHandler.CreateItem).Methods("POST")
	itemsRouter.HandleFunc("", itemHandler.BulkDeleteItems).Methods("DELETE")

	// Serve static files from public directory
	publicDir := "./public"
	if _, err := os.Stat(publicDir); err == nil {
		// Serve static assets
		router.PathPrefix("/assets/").Handler(http.StripPrefix("/assets/", http.FileServer(http.Dir(filepath.Join(publicDir, "assets")))))

		// Serve index.html for all other routes (SPA)
		router.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if file exists
			path := filepath.Join(publicDir, r.URL.Path)
			if _, err := os.Stat(path); err == nil {
				http.ServeFile(w, r, path)
				return
			}
			// Serve index.html for SPA routing
			http.ServeFile(w, r, filepath.Join(publicDir, "index.html"))
		})
	}

	log.Printf("[SETUP] Router initialization complete. All handlers registered.")
	// Apply CORS middleware to all routes
	return api.CorsMiddleware(router)
}
