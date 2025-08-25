#!/bin/bash

# TCIS Edge Functions Test Script
# This script tests all deployed Edge Functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ID=""
BASE_URL=""
JWT_TOKEN=""
TEST_CLIENT_ID=""
TEST_ROOM_ID=""

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to get configuration
get_config() {
    if [ -z "$PROJECT_ID" ]; then
        read -p "Enter your Supabase project ID: " PROJECT_ID
    fi
    
    if [ -z "$JWT_TOKEN" ]; then
        read -p "Enter your JWT token: " JWT_TOKEN
    fi
    
    BASE_URL="https://$PROJECT_ID.supabase.co/functions/v1"
    echo "Using base URL: $BASE_URL"
}

# Function to test HTTP endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    
    print_status "Testing: $test_name"
    
    local response
    local status_code
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" -eq "$expected_status" ]; then
        print_success "$test_name - Status: $status_code"
        return 0
    else
        print_error "$test_name - Expected: $expected_status, Got: $status_code"
        echo "Response: $body"
        return 1
    fi
}

# Test individual functions
test_clients_create() {
    local test_data='{"name": "Test Client '$(date +%s)'"}'
    if test_endpoint "POST" "/clients-create" "$test_data" 201 "Create Client"; then
        # Extract client ID for later tests
        TEST_CLIENT_ID=$(echo "$body" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)
        echo "Created test client: $TEST_CLIENT_ID"
    fi
}

test_rooms_create() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        print_warning "Skipping room creation - no test client available"
        return
    fi
    
    local test_data="{\"client_id\": \"$TEST_CLIENT_ID\", \"type\": \"internal\", \"name\": \"Test Room $(date +%s)\"}"
    if test_endpoint "POST" "/rooms-create" "$test_data" 201 "Create Room"; then
        TEST_ROOM_ID=$(echo "$body" | grep -o '"room_id":"[^"]*"' | cut -d'"' -f4)
        echo "Created test room: $TEST_ROOM_ID"
    fi
}

test_upload_url() {
    if [ -z "$TEST_CLIENT_ID" ] || [ -z "$TEST_ROOM_ID" ]; then
        print_warning "Skipping upload URL test - missing client or room"
        return
    fi
    
    local file_digest="a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
    local test_data="{\"client_id\": \"$TEST_CLIENT_ID\", \"room_id\": \"$TEST_ROOM_ID\", \"file_name\": \"test.txt\", \"file_digest\": \"$file_digest\"}"
    test_endpoint "POST" "/upload-url" "$test_data" 200 "Request Upload URL"
}

test_jobs_list() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        print_warning "Skipping jobs list test - no test client available"
        return
    fi
    
    test_endpoint "GET" "/jobs?client_id=$TEST_CLIENT_ID" "" 200 "List Jobs"
}

test_conversations_create() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        print_warning "Skipping conversation creation - no test client available"
        return
    fi
    
    local test_data="{\"client_id\": \"$TEST_CLIENT_ID\", \"title\": \"Test Conversation\"}"
    test_endpoint "POST" "/conversations-create" "$test_data" 201 "Create Conversation"
}

test_feedback() {
    # This test requires valid query and chunk IDs, so we'll just test the validation
    local test_data='{"query_id": "invalid-uuid", "chunk_id": "invalid-uuid", "useful_flag": true}'
    test_endpoint "POST" "/feedback" "$test_data" 400 "Feedback Validation (Expected Failure)"
}

# Test authentication
test_auth() {
    print_status "Testing authentication..."
    
    # Test without token
    local response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/clients-create" -H "Content-Type: application/json" -d '{"name": "Test"}')
    local status_code=$(echo "$response" | tail -n1)
    
    if [ "$status_code" -eq 401 ]; then
        print_success "Authentication test - Correctly rejected request without token"
    else
        print_error "Authentication test - Expected 401, got $status_code"
    fi
}

# Test CORS
test_cors() {
    print_status "Testing CORS headers..."
    
    local response=$(curl -s -I -X OPTIONS "$BASE_URL/clients-create")
    if echo "$response" | grep -i "access-control-allow-origin" > /dev/null; then
        print_success "CORS headers present"
    else
        print_warning "CORS headers not found"
    fi
}

# Run all tests
run_all_tests() {
    echo ""
    echo "========================================="
    echo "        TCIS FUNCTIONS TEST SUITE"
    echo "========================================="
    echo ""
    
    local passed=0
    local total=0
    
    # Authentication tests
    test_auth
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    test_cors
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    # Function tests
    test_clients_create
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    test_rooms_create
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    test_upload_url
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    test_jobs_list
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    test_conversations_create
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    test_feedback
    total=$((total + 1))
    [ $? -eq 0 ] && passed=$((passed + 1))
    
    # Summary
    echo ""
    echo "========================================="
    echo "            TEST RESULTS"
    echo "========================================="
    echo ""
    echo "Passed: $passed/$total tests"
    
    if [ $passed -eq $total ]; then
        print_success "All tests passed! 🎉"
        return 0
    else
        print_error "Some tests failed. Please check the output above."
        return 1
    fi
}

# Test streaming endpoint (SSE)
test_streaming() {
    if [ -z "$TEST_CLIENT_ID" ]; then
        print_warning "Skipping streaming test - no test client available"
        return
    fi
    
    print_status "Testing streaming query endpoint..."
    
    # Create a conversation first
    local conv_data="{\"client_id\": \"$TEST_CLIENT_ID\", \"title\": \"Stream Test\"}"
    local conv_response=$(curl -s -X POST \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$conv_data" \
        "$BASE_URL/conversations-create")
    
    local conv_id=$(echo "$conv_response" | grep -o '"conversation_id":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$conv_id" ]; then
        local query_data="{\"client_id\": \"$TEST_CLIENT_ID\", \"conversation_id\": \"$conv_id\", \"question\": \"Test query\", \"evaluation_mode\": false}"
        
        # Test SSE connection (just check if it connects)
        timeout 5 curl -N -H "Authorization: Bearer $JWT_TOKEN" \
            -H "Content-Type: application/json" \
            -H "Accept: text/event-stream" \
            -d "$query_data" \
            "$BASE_URL/query" > /dev/null 2>&1
        
        if [ $? -eq 124 ]; then  # timeout exit code
            print_success "Streaming endpoint - Connection established"
        else
            print_error "Streaming endpoint - Connection failed"
        fi
    else
        print_error "Could not create test conversation for streaming test"
    fi
}

# Load test (optional)
load_test() {
    if [ "$1" != "--load-test" ]; then
        return
    fi
    
    print_status "Running load test..."
    
    local concurrent=5
    local requests=20
    
    echo "Testing with $concurrent concurrent connections, $requests requests each"
    
    for i in $(seq 1 $concurrent); do
        (
            for j in $(seq 1 $requests); do
                test_endpoint "POST" "/clients-create" "{\"name\": \"Load Test $i-$j\"}" 201 "Load Test $i-$j" > /dev/null 2>&1
            done
        ) &
    done
    
    wait
    print_success "Load test completed"
}

# Show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Test TCIS Supabase Edge Functions"
    echo ""
    echo "Options:"
    echo "  --project-id ID    Supabase project ID"
    echo "  --token TOKEN      JWT token for authentication"
    echo "  --streaming        Include streaming endpoint test"
    echo "  --load-test        Run load test"
    echo "  --help, -h         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Interactive test"
    echo "  $0 --project-id abc123 --token xyz   # Automated test"
    echo "  $0 --streaming --load-test           # Full test suite"
}

# Main function
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --project-id)
                PROJECT_ID="$2"
                shift 2
                ;;
            --token)
                JWT_TOKEN="$2"
                shift 2
                ;;
            --streaming)
                RUN_STREAMING=true
                shift
                ;;
            --load-test)
                RUN_LOAD_TEST=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    get_config
    
    if run_all_tests; then
        if [ "$RUN_STREAMING" = true ]; then
            test_streaming
        fi
        
        if [ "$RUN_LOAD_TEST" = true ]; then
            load_test --load-test
        fi
        
        echo ""
        print_success "🚀 All tests completed successfully!"
        exit 0
    else
        echo ""
        print_error "❌ Some tests failed. Please check your deployment."
        exit 1
    fi
}

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
