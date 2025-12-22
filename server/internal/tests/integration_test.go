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

// TestOptimisticLockingListUpdate tests concurrent list updates with version conflicts
func TestOptimisticLockingListUpdate(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-optimistic"

	t.Run("Update with outdated version should fail", func(t *testing.T) {
		// Create a list
		createReq := models.CreateListRequest{
			Name:        "Test List",
			Description: "Original description",
		}
		rec := makeRequest(t, handler, "POST", "/api/v1/lists", createReq, userID)

		if rec.Code != http.StatusCreated {
			t.Fatalf("Expected status 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var list models.ListResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		originalVersion := list.Version

		// First update (should succeed)
		updateReq1 := models.UpdateListRequest{
			Name:        "Updated Name 1",
			Description: "Updated description 1",
			Version:     originalVersion,
		}
		path := fmt.Sprintf("/api/v1/lists/%s", list.ID)
		rec1 := makeRequest(t, handler, "PUT", path, updateReq1, userID)

		if rec1.Code != http.StatusOK {
			t.Fatalf("First update failed with status %d: %s", rec1.Code, rec1.Body.String())
		}

		var updatedList1 models.ListResponse
		if err := json.Unmarshal(rec1.Body.Bytes(), &updatedList1); err != nil {
			t.Fatalf("Failed to parse first update response: %v", err)
		}

		if updatedList1.Version != originalVersion+1 {
			t.Errorf("Expected version %d, got %d", originalVersion+1, updatedList1.Version)
		}

		// Second update with OUTDATED version (should fail with 409 Conflict)
		updateReq2 := models.UpdateListRequest{
			Name:        "Updated Name 2",
			Description: "Updated description 2",
			Version:     originalVersion, // Using old version
		}
		rec2 := makeRequest(t, handler, "PUT", path, updateReq2, userID)

		if rec2.Code != http.StatusConflict {
			t.Errorf("Expected status 409 Conflict, got %d: %s", rec2.Code, rec2.Body.String())
		}

		var errResp models.APIError
		if err := json.Unmarshal(rec2.Body.Bytes(), &errResp); err != nil {
			t.Fatalf("Failed to parse error response: %v", err)
		}

		if errResp.Error != "version_conflict" {
			t.Errorf("Expected error code 'version_conflict', got '%s'", errResp.Error)
		}

		// Verify the list still has the first update
		recGet := makeRequest(t, handler, "GET", path, nil, userID)
		var finalList models.ListResponse
		if err := json.Unmarshal(recGet.Body.Bytes(), &finalList); err != nil {
			t.Fatalf("Failed to parse get response: %v", err)
		}

		if finalList.Name != "Updated Name 1" {
			t.Errorf("Expected name 'Updated Name 1', got '%s'", finalList.Name)
		}
		if finalList.Version != originalVersion+1 {
			t.Errorf("Expected version %d, got %d", originalVersion+1, finalList.Version)
		}
	})
}

// TestOptimisticLockingListDelete tests concurrent list deletion with version conflicts
func TestOptimisticLockingListDelete(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-delete-optimistic"

	t.Run("Delete with outdated version should fail", func(t *testing.T) {
		// Create a list
		createReq := models.CreateListRequest{
			Name: "List to Delete",
		}
		rec := makeRequest(t, handler, "POST", "/api/v1/lists", createReq, userID)

		var list models.ListResponse
		json.Unmarshal(rec.Body.Bytes(), &list)
		originalVersion := list.Version

		// Update the list to increment version
		updateReq := models.UpdateListRequest{
			Name:    "Updated Name",
			Version: originalVersion,
		}
		path := fmt.Sprintf("/api/v1/lists/%s", list.ID)
		makeRequest(t, handler, "PUT", path, updateReq, userID)

		// Try to delete with OUTDATED version (should fail with 409)
		deleteReq := models.DeleteListRequest{
			Version: originalVersion, // Old version
		}
		recDelete := makeRequest(t, handler, "DELETE", path, deleteReq, userID)

		if recDelete.Code != http.StatusConflict {
			t.Errorf("Expected status 409 Conflict, got %d: %s", recDelete.Code, recDelete.Body.String())
		}

		// Verify list still exists
		recGet := makeRequest(t, handler, "GET", path, nil, userID)
		if recGet.Code != http.StatusOK {
			t.Error("List should still exist after failed delete")
		}
	})

	t.Run("Delete with correct version should succeed", func(t *testing.T) {
		// Create a list
		createReq := models.CreateListRequest{
			Name: "List to Delete 2",
		}
		rec := makeRequest(t, handler, "POST", "/api/v1/lists", createReq, userID)

		var list models.ListResponse
		json.Unmarshal(rec.Body.Bytes(), &list)

		// Delete with correct version
		deleteReq := models.DeleteListRequest{
			Version: list.Version,
		}
		path := fmt.Sprintf("/api/v1/lists/%s", list.ID)
		recDelete := makeRequest(t, handler, "DELETE", path, deleteReq, userID)

		if recDelete.Code != http.StatusNoContent {
			t.Errorf("Expected status 204, got %d: %s", recDelete.Code, recDelete.Body.String())
		}

		// Verify list is deleted
		recGet := makeRequest(t, handler, "GET", path, nil, userID)
		if recGet.Code == http.StatusOK {
			t.Error("List should be deleted")
		}
	})

	t.Run("Delete non-existent list should be idempotent", func(t *testing.T) {
		// Try to delete a non-existent list
		deleteReq := models.DeleteListRequest{
			Version: 1,
		}
		path := "/api/v1/lists/non-existent-uuid-12345"
		recDelete := makeRequest(t, handler, "DELETE", path, deleteReq, userID)

		// Should succeed (idempotent)
		if recDelete.Code != http.StatusNoContent {
			t.Errorf("Expected status 204 for idempotent delete, got %d: %s", recDelete.Code, recDelete.Body.String())
		}
	})
}

// TestOptimisticLockingItemUpdate tests concurrent item updates with version conflicts
func TestOptimisticLockingItemUpdate(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-item-optimistic"

	t.Run("Update item with outdated version should fail", func(t *testing.T) {
		// Create a list first
		createListReq := models.CreateListRequest{
			Name: "Test List for Items",
		}
		rec := makeRequest(t, handler, "POST", "/api/v1/lists", createListReq, userID)
		var list models.ListResponse
		json.Unmarshal(rec.Body.Bytes(), &list)

		// Create an item
		createItemReq := models.CreateItemRequest{
			Type: "item",
			Name: "Test Item",
		}
		itemPath := fmt.Sprintf("/api/v1/lists/%s/items", list.ID)
		recItem := makeRequest(t, handler, "POST", itemPath, createItemReq, userID)

		var item models.ItemResponse
		json.Unmarshal(recItem.Body.Bytes(), &item)
		originalVersion := item.Version

		// First update (should succeed)
		updateReq1 := models.UpdateItemRequest{
			Name:      "Updated Item 1",
			Completed: ptrBool(false),
			Version:   originalVersion,
		}
		updatePath := fmt.Sprintf("/api/v1/lists/%s/items/%s", list.ID, item.ID)
		rec1 := makeRequest(t, handler, "PUT", updatePath, updateReq1, userID)

		if rec1.Code != http.StatusOK {
			t.Fatalf("First update failed with status %d: %s", rec1.Code, rec1.Body.String())
		}

		var updatedItem1 models.ItemResponse
		json.Unmarshal(rec1.Body.Bytes(), &updatedItem1)

		if updatedItem1.Version != originalVersion+1 {
			t.Errorf("Expected version %d, got %d", originalVersion+1, updatedItem1.Version)
		}

		// Second update with OUTDATED version (should fail)
		updateReq2 := models.UpdateItemRequest{
			Name:      "Updated Item 2",
			Completed: ptrBool(true),
			Version:   originalVersion, // Old version
		}
		rec2 := makeRequest(t, handler, "PUT", updatePath, updateReq2, userID)

		if rec2.Code != http.StatusConflict {
			t.Errorf("Expected status 409 Conflict, got %d: %s", rec2.Code, rec2.Body.String())
		}

		// Verify item still has first update
		recGet := makeRequest(t, handler, "GET", updatePath, nil, userID)
		var finalItem models.ItemResponse
		json.Unmarshal(recGet.Body.Bytes(), &finalItem)

		if finalItem.Name != "Updated Item 1" {
			t.Errorf("Expected name 'Updated Item 1', got '%s'", finalItem.Name)
		}
		if finalItem.Version != originalVersion+1 {
			t.Errorf("Expected version %d, got %d", originalVersion+1, finalItem.Version)
		}
	})
}

// TestOptimisticLockingItemDelete tests concurrent item deletion with version conflicts
func TestOptimisticLockingItemDelete(t *testing.T) {
	clearDatabase(t)
	handler := setupTestRouter(t)
	userID := "test-user-item-delete-optimistic"

	t.Run("Delete item with outdated version should fail", func(t *testing.T) {
		// Create a list and item
		createListReq := models.CreateListRequest{
			Name: "Test List",
		}
		rec := makeRequest(t, handler, "POST", "/api/v1/lists", createListReq, userID)
		var list models.ListResponse
		json.Unmarshal(rec.Body.Bytes(), &list)

		createItemReq := models.CreateItemRequest{
			Type: "item",
			Name: "Item to Delete",
		}
		itemPath := fmt.Sprintf("/api/v1/lists/%s/items", list.ID)
		recItem := makeRequest(t, handler, "POST", itemPath, createItemReq, userID)

		var item models.ItemResponse
		json.Unmarshal(recItem.Body.Bytes(), &item)
		originalVersion := item.Version

		// Update the item to increment version
		updateReq := models.UpdateItemRequest{
			Name:      "Updated Item",
			Completed: ptrBool(false),
			Version:   originalVersion,
		}
		updatePath := fmt.Sprintf("/api/v1/lists/%s/items/%s", list.ID, item.ID)
		makeRequest(t, handler, "PUT", updatePath, updateReq, userID)

		// Try to delete with OUTDATED version (should fail)
		deleteReq := models.DeleteItemRequest{
			Version: originalVersion, // Old version
		}
		recDelete := makeRequest(t, handler, "DELETE", updatePath, deleteReq, userID)

		if recDelete.Code != http.StatusConflict {
			t.Errorf("Expected status 409 Conflict, got %d: %s", recDelete.Code, recDelete.Body.String())
		}

		// Verify item still exists
		recGet := makeRequest(t, handler, "GET", updatePath, nil, userID)
		if recGet.Code != http.StatusOK {
			t.Error("Item should still exist after failed delete")
		}
	})

	t.Run("Delete item with correct version should succeed", func(t *testing.T) {
		// Create a list and item
		createListReq := models.CreateListRequest{
			Name: "Test List 2",
		}
		rec := makeRequest(t, handler, "POST", "/api/v1/lists", createListReq, userID)
		var list models.ListResponse
		json.Unmarshal(rec.Body.Bytes(), &list)

		createItemReq := models.CreateItemRequest{
			Type: "item",
			Name: "Item to Delete 2",
		}
		itemPath := fmt.Sprintf("/api/v1/lists/%s/items", list.ID)
		recItem := makeRequest(t, handler, "POST", itemPath, createItemReq, userID)

		var item models.ItemResponse
		json.Unmarshal(recItem.Body.Bytes(), &item)

		// Delete with correct version
		deleteReq := models.DeleteItemRequest{
			Version: item.Version,
		}
		deletePath := fmt.Sprintf("/api/v1/lists/%s/items/%s", list.ID, item.ID)
		recDelete := makeRequest(t, handler, "DELETE", deletePath, deleteReq, userID)

		if recDelete.Code != http.StatusNoContent {
			t.Errorf("Expected status 204, got %d: %s", recDelete.Code, recDelete.Body.String())
		}
	})

	t.Run("Delete non-existent item should be idempotent", func(t *testing.T) {
		// Create a list
		createListReq := models.CreateListRequest{
			Name: "Test List 3",
		}
		rec := makeRequest(t, handler, "POST", "/api/v1/lists", createListReq, userID)
		var list models.ListResponse
		json.Unmarshal(rec.Body.Bytes(), &list)

		// Try to delete non-existent item
		deleteReq := models.DeleteItemRequest{
			Version: 1,
		}
		deletePath := fmt.Sprintf("/api/v1/lists/%s/items/non-existent-item-12345", list.ID)
		recDelete := makeRequest(t, handler, "DELETE", deletePath, deleteReq, userID)

		// Should succeed (idempotent)
		if recDelete.Code != http.StatusNoContent {
			t.Errorf("Expected status 204 for idempotent delete, got %d: %s", recDelete.Code, recDelete.Body.String())
		}
	})
}

// Helper function to create pointer to bool
func ptrBool(v bool) *bool {
	return &v
}
