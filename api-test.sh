#!/bin/bash

# API Test Script for Lists Viewer Backend
# Tests all CRUD operations for Lists and Items

BASE_URL="http://localhost:8080/api/v1"
USER_ID="test-user-$(date +%s)"

echo "========================================="
echo "Lists Viewer API Test Suite"
echo "========================================="
echo "Base URL: $BASE_URL"
echo "User ID: $USER_ID"
echo ""

# Helper function to make requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "X-User-Id: $USER_ID" \
            -H "Content-Type: application/json"
    else
        curl -s -X "$method" "$BASE_URL$endpoint" \
            -H "X-User-Id: $USER_ID" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Test 1: Health Check
echo "1. Testing Health Endpoints..."
echo "   GET /health/live"
curl -s http://localhost:8080/health/live | jq .
echo ""

# Test 2: Initialize User
echo "2. Initialize User..."
USER_INIT=$(make_request POST "/users/init" '{"username":"'$USER_ID'", "iconId":"icon1"}')
echo "$USER_INIT" | jq .
echo ""

# Test 3: Get Available Icons
echo "3. Get Available Icons..."
make_request GET "/icons" | jq .
echo ""

# Test 4: Create List
echo "4. Creating a List..."
LIST_1=$(make_request POST "/lists" '{"name":"Grocery Shopping", "description":"Weekly groceries"}')
echo "$LIST_1" | jq .
LIST_1_ID=$(echo "$LIST_1" | jq -r '.data.id // empty')
echo "Created List ID: $LIST_1_ID"
echo ""

# Test 5: Create another List
echo "5. Creating another List..."
LIST_2=$(make_request POST "/lists" '{"name":"Work Tasks", "description":"Tasks for the week"}')
LIST_2_ID=$(echo "$LIST_2" | jq -r '.data.id // empty')
echo "Created List ID: $LIST_2_ID"
echo ""

# Test 6: Get All Lists
echo "6. Getting All Lists..."
make_request GET "/lists" | jq .
echo ""

# Test 7: Get Specific List
echo "7. Getting Specific List..."
if [ ! -z "$LIST_1_ID" ]; then
    make_request GET "/lists/$LIST_1_ID" | jq .
else
    echo "   Skipped (List ID not found)"
fi
echo ""

# Test 8: Update List
echo "8. Updating List..."
if [ ! -z "$LIST_1_ID" ]; then
    make_request PUT "/lists/$LIST_1_ID" '{"name":"Grocery Shopping Updated", "description":"Weekly groceries - Updated"}' | jq .
else
    echo "   Skipped (List ID not found)"
fi
echo ""

# Test 9: Create Items in List 1
echo "9. Creating Items in List 1..."
if [ ! -z "$LIST_1_ID" ]; then
    ITEM_1=$(make_request POST "/lists/$LIST_1_ID/items" '{"content":"Milk", "type":"item", "quantity":2, "unit":"liters"}')
    ITEM_1_ID=$(echo "$ITEM_1" | jq -r '.data.id // empty')
    echo "Created Item ID: $ITEM_1_ID"
    echo "$ITEM_1" | jq .
    
    echo ""
    ITEM_2=$(make_request POST "/lists/$LIST_1_ID/items" '{"content":"Bread", "type":"item", "quantity":1, "unit":"loaf"}')
    ITEM_2_ID=$(echo "$ITEM_2" | jq -r '.data.id // empty')
    echo "Created Item ID: $ITEM_2_ID"
    echo "$ITEM_2" | jq .
    
    echo ""
    ITEM_3=$(make_request POST "/lists/$LIST_1_ID/items" '{"content":"Eggs", "type":"item", "quantity":12, "unit":"pieces"}')
    ITEM_3_ID=$(echo "$ITEM_3" | jq -r '.data.id // empty')
    echo "Created Item ID: $ITEM_3_ID"
    echo "$ITEM_3" | jq .
else
    echo "   Skipped (List ID not found)"
fi
echo ""

# Test 10: Get Items from List
echo "10. Getting Items from List..."
if [ ! -z "$LIST_1_ID" ]; then
    make_request GET "/lists/$LIST_1_ID/items" | jq .
else
    echo "    Skipped (List ID not found)"
fi
echo ""

# Test 11: Update Item
echo "11. Updating Item..."
if [ ! -z "$LIST_1_ID" ] && [ ! -z "$ITEM_1_ID" ]; then
    make_request PUT "/lists/$LIST_1_ID/items/$ITEM_1_ID" '{"content":"Milk (2% fat)", "quantity":3}' | jq .
else
    echo "    Skipped (List or Item ID not found)"
fi
echo ""

# Test 12: Mark Item as Complete
echo "12. Marking Item as Complete..."
if [ ! -z "$LIST_1_ID" ] && [ ! -z "$ITEM_1_ID" ]; then
    make_request PUT "/lists/$LIST_1_ID/items/$ITEM_1_ID" '{"completed":true}' | jq .
else
    echo "    Skipped (List or Item ID not found)"
fi
echo ""

# Test 13: Get Specific Item
echo "13. Getting Specific Item..."
if [ ! -z "$LIST_1_ID" ] && [ ! -z "$ITEM_1_ID" ]; then
    make_request GET "/lists/$LIST_1_ID/items/$ITEM_1_ID" | jq .
else
    echo "    Skipped (List or Item ID not found)"
fi
echo ""

# Test 14: Bulk Complete Items
echo "14. Bulk Complete Items..."
if [ ! -z "$LIST_1_ID" ] && [ ! -z "$ITEM_2_ID" ] && [ ! -z "$ITEM_3_ID" ]; then
    make_request PATCH "/lists/$LIST_1_ID/items/complete" '{"itemIds":["'$ITEM_2_ID'", "'$ITEM_3_ID'"]}' | jq .
else
    echo "    Skipped (List or Item IDs not found)"
fi
echo ""

# Test 15: Reorder Items
echo "15. Reordering Items..."
if [ ! -z "$LIST_1_ID" ] && [ ! -z "$ITEM_1_ID" ] && [ ! -z "$ITEM_2_ID" ]; then
    make_request PATCH "/lists/$LIST_1_ID/items/reorder" '{"items":[{"id":"'$ITEM_2_ID'","order":1},{"id":"'$ITEM_1_ID'","order":2}]}' | jq .
else
    echo "    Skipped (List or Item IDs not found)"
fi
echo ""

# Test 16: Delete Completed Items
echo "16. Deleting Completed Items..."
if [ ! -z "$LIST_1_ID" ]; then
    make_request DELETE "/lists/$LIST_1_ID/items/completed" | jq .
else
    echo "    Skipped (List ID not found)"
fi
echo ""

# Test 17: Delete Single Item
echo "17. Deleting Single Item..."
if [ ! -z "$LIST_1_ID" ] && [ ! -z "$ITEM_1_ID" ]; then
    make_request DELETE "/lists/$LIST_1_ID/items/$ITEM_1_ID" | jq .
else
    echo "    Skipped (List or Item ID not found)"
fi
echo ""

# Test 18: Delete List
echo "18. Deleting List..."
if [ ! -z "$LIST_2_ID" ]; then
    make_request DELETE "/lists/$LIST_2_ID" | jq .
else
    echo "    Skipped (List ID not found)"
fi
echo ""

echo "========================================="
echo "API Test Suite Complete"
echo "========================================="
