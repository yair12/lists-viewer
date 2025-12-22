package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/yair12/lists-viewer/server/internal/models"
	"github.com/yair12/lists-viewer/server/internal/setup"
)

var (
	mongoContainer testcontainers.Container
	mongoClient    *mongo.Client
)

// TestMain sets up and tears down the test containers
func TestMain(m *testing.M) {
	ctx := context.Background()

	// Start MongoDB container
	req := testcontainers.ContainerRequest{
		Image:        "mongo:5.0",
		ExposedPorts: []string{"27017/tcp"},
		Env: map[string]string{
			"MONGO_INITDB_ROOT_USERNAME": "root",
			"MONGO_INITDB_ROOT_PASSWORD": "rootpassword",
		},
		WaitingFor: wait.ForLog("started successfully"),
	}

	var err error
	mongoContainer, err = testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		panic(fmt.Sprintf("Failed to start MongoDB container: %v", err))
	}

	// Get connection URI
	host, err := mongoContainer.Host(ctx)
	if err != nil {
		panic(fmt.Sprintf("Failed to get container host: %v", err))
	}

	port, err := mongoContainer.MappedPort(ctx, "27017")
	if err != nil {
		panic(fmt.Sprintf("Failed to get container port: %v", err))
	}

	mongoURI := fmt.Sprintf("mongodb://root:rootpassword@%s:%s/?authSource=admin", host, port.Port())

	// Connect MongoDB client
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err = mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		panic(fmt.Sprintf("Failed to connect MongoDB: %v", err))
	}

	// Verify connection
	if err := mongoClient.Ping(ctx, nil); err != nil {
		panic(fmt.Sprintf("Failed to ping MongoDB: %v", err))
	}

	// Run tests
	code := m.Run()

	// Cleanup
	if err := mongoClient.Disconnect(context.Background()); err != nil {
		fmt.Printf("Failed to disconnect MongoDB: %v\n", err)
	}

	if err := mongoContainer.Terminate(context.Background()); err != nil {
		fmt.Printf("Failed to terminate MongoDB container: %v\n", err)
	}

	os.Exit(code)
}

func setupTestRouter(t *testing.T) http.Handler {
	return setup.SetupRouter(mongoClient)
}

func clearDatabase(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db := mongoClient.Database("lists_viewer")
	collections := []string{"lists", "items", "users"}
	for _, col := range collections {
		if _, err := db.Collection(col).DeleteMany(ctx, map[string]interface{}{}); err != nil {
			t.Fatalf("Failed to clear collection %s: %v", col, err)
		}
	}
}

func makeRequest(t *testing.T, handler http.Handler, method, path string, body interface{}, userID string) *httptest.ResponseRecorder {
	var bodyReader *bytes.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("Failed to marshal body: %v", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	} else {
		bodyReader = bytes.NewReader([]byte{})
	}

	req := httptest.NewRequest(method, path, bodyReader)
	if userID != "" {
		req.Header.Set("X-User-Id", userID)
	}
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

// Test cases

func TestHealthEndpoints(t *testing.T) {
	handler := setupTestRouter(t)

	tests := []struct {
		name           string
		path           string
		expectedStatus int
	}{
		{
			name:           "Liveness probe root",
			path:           "/health/live",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Readiness probe root",
			path:           "/health/ready",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Health check API v1",
			path:           "/api/v1/health",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := makeRequest(t, handler, "GET", tt.path, nil, "test-user")
			if rec.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
		})
	}
}

func TestUserInitialization(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)

	t.Run("Initialize new user", func(t *testing.T) {
		req := models.InitUserRequest{
			Username: "testuser",
			IconID:   "icon1",
		}

		rec := makeRequest(t, handler, "POST", "/api/v1/users/init", req, "")
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var response models.UserResponse
		if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response.Username != "testuser" {
			t.Errorf("Expected username 'testuser', got '%s'", response.Username)
		}
	})

	t.Run("Get available icons", func(t *testing.T) {
		rec := makeRequest(t, handler, "GET", "/api/v1/icons", nil, "test-user")
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rec.Code)
		}

		var response models.IconsResponse
		if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if len(response.Data) == 0 {
			t.Error("Expected icons list to be non-empty")
		}
	})
}

func TestListCRUD(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-123"

	var listID string
	var version int32

	t.Run("Create list", func(t *testing.T) {
		req := models.CreateListRequest{
			Name:        "My List",
			Description: "Test list",
		}

		rec := makeRequest(t, handler, "POST", "/api/v1/lists", req, userID)
		if rec.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var list models.ListResponse
		if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		listID = list.ID
		version = list.Version

		if list.Name != "My List" {
			t.Errorf("Expected name 'My List', got '%s'", list.Name)
		}
	})

	t.Run("Get all lists", func(t *testing.T) {
		rec := makeRequest(t, handler, "GET", "/api/v1/lists", nil, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rec.Code)
		}

		var response models.ListsResponse
		if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if len(response.Data) == 0 {
			t.Error("Expected at least one list")
		}
	})

	t.Run("Get list by ID", func(t *testing.T) {
		path := fmt.Sprintf("/api/v1/lists/%s", listID)
		rec := makeRequest(t, handler, "GET", path, nil, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rec.Code)
		}

		var list models.ListResponse
		if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if list.ID != listID {
			t.Errorf("Expected list ID '%s', got '%s'", listID, list.ID)
		}
	})

	t.Run("Update list", func(t *testing.T) {
		req := models.UpdateListRequest{
			Name:    "Updated List",
			Version: version,
		}

		path := fmt.Sprintf("/api/v1/lists/%s", listID)
		rec := makeRequest(t, handler, "PUT", path, req, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var list models.ListResponse
		if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if list.Name != "Updated List" {
			t.Errorf("Expected name 'Updated List', got '%s'", list.Name)
		}

		version = list.Version
	})

	t.Run("Delete list", func(t *testing.T) {
		req := models.DeleteListRequest{
			Version: version,
		}

		path := fmt.Sprintf("/api/v1/lists/%s", listID)
		rec := makeRequest(t, handler, "DELETE", path, req, userID)
		if rec.Code != http.StatusNoContent {
			t.Errorf("Expected status 204, got %d: %s", rec.Code, rec.Body.String())
		}
	})
}

func TestItemCRUD(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-items"

	// Create a list first
	createListReq := models.CreateListRequest{
		Name: "Item Test List",
	}

	rec := makeRequest(t, handler, "POST", "/api/v1/lists", createListReq, userID)
	if rec.Code != http.StatusCreated {
		t.Fatalf("Failed to create list: %d", rec.Code)
	}

	var list models.ListResponse
	json.NewDecoder(rec.Body).Decode(&list)
	listID := list.ID

	var itemID string
	var itemVersion int32

	t.Run("Create item", func(t *testing.T) {
		req := models.CreateItemRequest{
			Name:         "Buy groceries",
			Type:         "item",
			Quantity:     ptrInt32(2),
			QuantityType: "packs",
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items", listID)
		rec := makeRequest(t, handler, "POST", path, req, userID)
		if rec.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var item models.ItemResponse
		if err := json.NewDecoder(rec.Body).Decode(&item); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		itemID = item.ID
		itemVersion = item.Version

		if item.Name != "Buy groceries" {
			t.Errorf("Expected name 'Buy groceries', got '%s'", item.Name)
		}
	})

	t.Run("Get items by list", func(t *testing.T) {
		path := fmt.Sprintf("/api/v1/lists/%s/items", listID)
		rec := makeRequest(t, handler, "GET", path, nil, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rec.Code)
		}

		var response models.ItemsResponse
		if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if len(response.Data) == 0 {
			t.Error("Expected at least one item")
		}
	})

	t.Run("Get item by ID", func(t *testing.T) {
		path := fmt.Sprintf("/api/v1/lists/%s/items/%s", listID, itemID)
		rec := makeRequest(t, handler, "GET", path, nil, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rec.Code)
		}

		var item models.ItemResponse
		if err := json.NewDecoder(rec.Body).Decode(&item); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if item.ID != itemID {
			t.Errorf("Expected item ID '%s', got '%s'", itemID, item.ID)
		}
	})

	t.Run("Update item", func(t *testing.T) {
		completed := true
		req := models.UpdateItemRequest{
			Name:      "Buy groceries (updated)",
			Completed: &completed,
			Version:   itemVersion,
			Order:     0,
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items/%s", listID, itemID)
		rec := makeRequest(t, handler, "PUT", path, req, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var item models.ItemResponse
		if err := json.NewDecoder(rec.Body).Decode(&item); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if !item.Completed {
			t.Error("Expected item to be completed")
		}

		itemVersion = item.Version
	})

	t.Run("Delete item", func(t *testing.T) {
		req := models.DeleteItemRequest{
			Version: itemVersion,
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items/%s", listID, itemID)
		rec := makeRequest(t, handler, "DELETE", path, req, userID)
		if rec.Code != http.StatusNoContent {
			t.Errorf("Expected status 204, got %d", rec.Code)
		}
	})
}

func TestItemBulkOperations(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-bulk"

	// Create a list first
	createListReq := models.CreateListRequest{
		Name: "Bulk Operations List",
	}

	rec := makeRequest(t, handler, "POST", "/api/v1/lists", createListReq, userID)
	var list models.ListResponse
	json.NewDecoder(rec.Body).Decode(&list)
	listID := list.ID

	// Create multiple items
	itemIDs := make([]string, 3)
	for i := 0; i < 3; i++ {
		req := models.CreateItemRequest{
			Name: fmt.Sprintf("Item %d", i+1),
			Type: "item",
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items", listID)
		rec := makeRequest(t, handler, "POST", path, req, userID)

		var item models.ItemResponse
		json.NewDecoder(rec.Body).Decode(&item)
		itemIDs[i] = item.ID
	}

	t.Run("Bulk complete items", func(t *testing.T) {
		req := models.BulkCompleteRequest{
			ItemIDs: itemIDs[:2],
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items/complete", listID)
		t.Logf("Making PATCH request to: %s", path)
		t.Logf("Request body: %+v", req)
		t.Logf("Item IDs: %v", itemIDs)
		rec := makeRequest(t, handler, "PATCH", path, req, userID)
		t.Logf("Response code: %d", rec.Code)
		t.Logf("Response body: %s", rec.Body.String())
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var response models.BulkCompleteResponse
		if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response.CompletedCount != 2 {
			t.Errorf("Expected 2 completed items, got %d", response.CompletedCount)
		}
	})

	t.Run("Delete completed items", func(t *testing.T) {
		path := fmt.Sprintf("/api/v1/lists/%s/items/completed", listID)
		t.Logf("Making DELETE request to: %s", path)
		rec := makeRequest(t, handler, "DELETE", path, nil, userID)
		t.Logf("Response code: %d", rec.Code)
		t.Logf("Response body: %s", rec.Body.String())
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("Bulk delete items", func(t *testing.T) {
		req := models.BulkDeleteRequest{
			ItemIDs: []string{itemIDs[2]},
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items", listID)
		rec := makeRequest(t, handler, "DELETE", path, req, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rec.Code)
		}
	})
}

func TestMissingUserIDHeader(t *testing.T) {
	handler := setupTestRouter(t)

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"Get lists without user ID", "GET", "/api/v1/lists"},
		{"Create list without user ID", "POST", "/api/v1/lists"},
		{"Get icons without user ID", "GET", "/api/v1/icons"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := makeRequest(t, handler, tt.method, tt.path, nil, "")
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("Expected status 401, got %d", rec.Code)
			}
		})
	}
}

func TestItemReorder(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-reorder"

	// Create a list and items
	createListReq := models.CreateListRequest{Name: "Reorder List"}
	rec := makeRequest(t, handler, "POST", "/api/v1/lists", createListReq, userID)
	var list models.ListResponse
	json.NewDecoder(rec.Body).Decode(&list)
	listID := list.ID

	// Create 2 items
	itemIDs := make([]string, 2)
	for i := 0; i < 2; i++ {
		req := models.CreateItemRequest{Name: fmt.Sprintf("Item %d", i+1), Type: "item"}
		path := fmt.Sprintf("/api/v1/lists/%s/items", listID)
		rec := makeRequest(t, handler, "POST", path, req, userID)
		var item models.ItemResponse
		json.NewDecoder(rec.Body).Decode(&item)
		itemIDs[i] = item.ID
	}

	t.Run("Reorder items", func(t *testing.T) {
		req := models.ReorderItemsRequest{
			Items: []models.ReorderItem{
				{ID: itemIDs[1], Order: 0},
				{ID: itemIDs[0], Order: 1},
			},
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items/reorder", listID)
		rec := makeRequest(t, handler, "PATCH", path, req, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", rec.Code, rec.Body.String())
			return
		}

		// Verify the reorder worked by fetching items
		getPath := fmt.Sprintf("/api/v1/lists/%s/items", listID)
		getRec := makeRequest(t, handler, "GET", getPath, nil, userID)
		if getRec.Code != http.StatusOK {
			t.Fatalf("Failed to get items: %d", getRec.Code)
		}

		var itemsResp models.ItemsResponse
		if err := json.NewDecoder(getRec.Body).Decode(&itemsResp); err != nil {
			t.Fatalf("Failed to decode items: %v", err)
		}

		items := itemsResp.Data
		if len(items) != 2 {
			t.Fatalf("Expected 2 items, got %d", len(items))
		}

		// Check that item order matches the reorder request
		if items[0].ID != itemIDs[1] {
			t.Errorf("Expected first item to be %s, got %s", itemIDs[1], items[0].ID)
		}
		if items[1].ID != itemIDs[0] {
			t.Errorf("Expected second item to be %s, got %s", itemIDs[0], items[1].ID)
		}
		if items[0].Order != 0 {
			t.Errorf("Expected first item order to be 0, got %d", items[0].Order)
		}
		if items[1].Order != 1 {
			t.Errorf("Expected second item order to be 1, got %d", items[1].Order)
		}
	})
}

func TestItemMove(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-move"

	// Create source and target lists
	sourceListReq := models.CreateListRequest{Name: "Source List"}
	rec := makeRequest(t, handler, "POST", "/api/v1/lists", sourceListReq, userID)
	var sourceList models.ListResponse
	json.NewDecoder(rec.Body).Decode(&sourceList)
	sourceListID := sourceList.ID

	targetListReq := models.CreateListRequest{Name: "Target List"}
	rec = makeRequest(t, handler, "POST", "/api/v1/lists", targetListReq, userID)
	var targetList models.ListResponse
	json.NewDecoder(rec.Body).Decode(&targetList)
	targetListID := targetList.ID

	// Create item in source list
	itemReq := models.CreateItemRequest{Name: "Item to move", Type: "item"}
	path := fmt.Sprintf("/api/v1/lists/%s/items", sourceListID)
	rec = makeRequest(t, handler, "POST", path, itemReq, userID)
	var item models.ItemResponse
	json.NewDecoder(rec.Body).Decode(&item)
	itemID := item.ID

	t.Run("Move item between lists", func(t *testing.T) {
		req := models.MoveItemRequest{
			TargetListID: targetListID,
			Order:        0,
			Version:      1,
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items/%s/move", sourceListID, itemID)
		rec := makeRequest(t, handler, "PATCH", path, req, userID)
		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", rec.Code, rec.Body.String())
			return
		}

		var movedItem models.ItemResponse
		if err := json.NewDecoder(rec.Body).Decode(&movedItem); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if movedItem.ListID != targetListID {
			t.Errorf("Expected item listId to be %s, got %s", targetListID, movedItem.ListID)
		}

		// Verify item is in target list
		getPath := fmt.Sprintf("/api/v1/lists/%s/items", targetListID)
		getRec := makeRequest(t, handler, "GET", getPath, nil, userID)
		var targetItemsResp models.ItemsResponse
		json.NewDecoder(getRec.Body).Decode(&targetItemsResp)

		if len(targetItemsResp.Data) != 1 {
			t.Errorf("Expected 1 item in target list, got %d", len(targetItemsResp.Data))
		}

		// Verify item is not in source list
		getPath = fmt.Sprintf("/api/v1/lists/%s/items", sourceListID)
		getRec = makeRequest(t, handler, "GET", getPath, nil, userID)
		var sourceItemsResp models.ItemsResponse
		json.NewDecoder(getRec.Body).Decode(&sourceItemsResp)

		if len(sourceItemsResp.Data) != 0 {
			t.Errorf("Expected 0 items in source list, got %d", len(sourceItemsResp.Data))
		}
	})
}

func TestNestedLists(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-nested"

	// Create parent list
	parentReq := models.CreateListRequest{Name: "Parent List"}
	rec := makeRequest(t, handler, "POST", "/api/v1/lists", parentReq, userID)
	var parentList models.ListResponse
	json.NewDecoder(rec.Body).Decode(&parentList)
	parentListID := parentList.ID

	t.Run("Create nested list", func(t *testing.T) {
		req := models.CreateItemRequest{
			Name: "Nested List",
			Type: "list",
		}

		path := fmt.Sprintf("/api/v1/lists/%s/items", parentListID)
		rec := makeRequest(t, handler, "POST", path, req, userID)
		if rec.Code != http.StatusCreated {
			t.Errorf("Expected status 201, got %d: %s", rec.Code, rec.Body.String())
			return
		}

		var nestedList models.ItemResponse
		if err := json.NewDecoder(rec.Body).Decode(&nestedList); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if nestedList.Type != "list" {
			t.Errorf("Expected type 'list', got %s", nestedList.Type)
		}
		if nestedList.Name != "Nested List" {
			t.Errorf("Expected name 'Nested List', got %s", nestedList.Name)
		}
	})

	t.Run("Get items including nested lists", func(t *testing.T) {
		// Add a regular item too
		itemReq := models.CreateItemRequest{
			Name: "Regular Item",
			Type: "item",
		}
		path := fmt.Sprintf("/api/v1/lists/%s/items", parentListID)
		makeRequest(t, handler, "POST", path, itemReq, userID)

		// Get all items
		getPath := fmt.Sprintf("/api/v1/lists/%s/items", parentListID)
		rec := makeRequest(t, handler, "GET", getPath, nil, userID)
		if rec.Code != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", rec.Code)
		}

		var itemsResp models.ItemsResponse
		if err := json.NewDecoder(rec.Body).Decode(&itemsResp); err != nil {
			t.Fatalf("Failed to decode items: %v", err)
		}

		items := itemsResp.Data
		if len(items) != 2 {
			t.Errorf("Expected 2 items, got %d", len(items))
		}

		// Check we have one list and one item
		hasListType := false
		hasItemType := false
		for _, item := range items {
			if item.Type == "list" {
				hasListType = true
			}
			if item.Type == "item" {
				hasItemType = true
			}
		}

		if !hasListType {
			t.Error("Expected at least one item with type 'list'")
		}
		if !hasItemType {
			t.Error("Expected at least one item with type 'item'")
		}
	})
}

// Helper function to create pointer to int32
func ptrInt32(v int32) *int32 {
	return &v
}
