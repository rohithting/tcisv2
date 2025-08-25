#!/bin/bash

# TCIS Supabase Edge Functions Deployment Script
# This script deploys all Edge Functions for the Ting Chat Insight System

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=""
SUPABASE_ACCESS_TOKEN=""
FUNCTIONS_DIR="supabase/functions"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        print_error "Supabase CLI is not installed. Please install it first:"
        echo "npm install -g supabase"
        echo "or"
        echo "brew install supabase/tap/supabase"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -d "$FUNCTIONS_DIR" ]; then
        print_error "Functions directory not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check if user is logged in to Supabase
    if ! supabase projects list &> /dev/null; then
        print_error "Not logged in to Supabase. Please run:"
        echo "supabase login"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to get project ID if not provided
get_project_id() {
    if [ -z "$PROJECT_ID" ]; then
        print_status "No project ID provided. Fetching available projects..."
        echo ""
        supabase projects list
        echo ""
        read -p "Enter your Supabase project ID: " PROJECT_ID
        
        if [ -z "$PROJECT_ID" ]; then
            print_error "Project ID is required"
            exit 1
        fi
    fi
    
    print_status "Using project ID: $PROJECT_ID"
}

# Function to link project
link_project() {
    print_status "Linking to Supabase project..."
    
    # Check if already linked
    if [ -f ".supabase/config.toml" ]; then
        print_warning "Project already linked. Skipping..."
    else
        supabase link --project-ref "$PROJECT_ID"
        print_success "Project linked successfully"
    fi
}

# List of all functions to deploy
FUNCTIONS=(
    "clients-create"
    "rooms-create"
    "upload-url"
    "ingest"
    "jobs"
    "conversations-create"
    "query"
    "feedback"
    "job-retry"
    "reindex"
)

# Function to deploy a single function
deploy_function() {
    local func_name=$1
    local func_dir="$FUNCTIONS_DIR/$func_name"
    
    if [ ! -d "$func_dir" ]; then
        print_error "Function directory not found: $func_dir"
        return 1
    fi
    
    print_status "Deploying function: $func_name"
    
    # Deploy the function
    if supabase functions deploy "$func_name" --project-ref "$PROJECT_ID"; then
        print_success "Successfully deployed: $func_name"
        return 0
    else
        print_error "Failed to deploy: $func_name"
        return 1
    fi
}

# Function to deploy all functions
deploy_all_functions() {
    local failed_functions=()
    local successful_functions=()
    
    print_status "Starting deployment of ${#FUNCTIONS[@]} functions..."
    echo ""
    
    for func in "${FUNCTIONS[@]}"; do
        if deploy_function "$func"; then
            successful_functions+=("$func")
        else
            failed_functions+=("$func")
        fi
        echo ""  # Add spacing between deployments
    done
    
    # Summary
    echo ""
    echo "========================================="
    echo "           DEPLOYMENT SUMMARY"
    echo "========================================="
    
    if [ ${#successful_functions[@]} -gt 0 ]; then
        print_success "Successfully deployed (${#successful_functions[@]}):"
        for func in "${successful_functions[@]}"; do
            echo "  ✓ $func"
        done
    fi
    
    if [ ${#failed_functions[@]} -gt 0 ]; then
        echo ""
        print_error "Failed to deploy (${#failed_functions[@]}):"
        for func in "${failed_functions[@]}"; do
            echo "  ✗ $func"
        done
        echo ""
        print_warning "You can retry failed functions individually using:"
        print_warning "supabase functions deploy <function-name> --project-ref $PROJECT_ID"
        return 1
    fi
    
    echo ""
    print_success "All functions deployed successfully! 🎉"
    return 0
}

# Function to verify deployments
verify_deployments() {
    print_status "Verifying deployed functions..."
    
    # List all functions
    if supabase functions list --project-ref "$PROJECT_ID"; then
        print_success "Function verification completed"
    else
        print_warning "Could not verify function deployments"
    fi
}

# Function to set up environment variables (if needed)
setup_environment() {
    print_status "Checking environment variables..."
    
    # Check if .env file exists
    if [ -f ".env" ]; then
        print_warning "Remember to set up the following environment variables in your Supabase project:"
        echo "  - SUPABASE_URL"
        echo "  - SUPABASE_SERVICE_ROLE_KEY"
        echo "  - Any other custom environment variables"
        echo ""
        echo "You can set them using:"
        echo "supabase secrets set KEY=value --project-ref $PROJECT_ID"
    fi
}

# Function to show function URLs
show_function_urls() {
    local base_url="https://$PROJECT_ID.supabase.co/functions/v1"
    
    echo ""
    echo "========================================="
    echo "           FUNCTION ENDPOINTS"
    echo "========================================="
    echo ""
    echo "Base URL: $base_url"
    echo ""
    echo "Available endpoints:"
    
    for func in "${FUNCTIONS[@]}"; do
        echo "  POST $base_url/$func"
    done
    
    echo ""
    echo "Note: All endpoints require Authorization header with Bearer token"
    echo "Example: curl -H 'Authorization: Bearer <jwt-token>' ..."
}

# Function to run tests (optional)
run_tests() {
    if [ "$1" = "--test" ]; then
        print_status "Running function tests..."
        
        # Add your test commands here
        # Example: npm test or custom test scripts
        
        print_warning "Test suite not implemented yet"
        return 0
    fi
}

# Main deployment function
main() {
    echo ""
    echo "========================================="
    echo "    TCIS Edge Functions Deployment"
    echo "========================================="
    echo ""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --project-id)
                PROJECT_ID="$2"
                shift 2
                ;;
            --test)
                RUN_TESTS=true
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
    
    # Run deployment steps
    check_prerequisites
    get_project_id
    link_project
    setup_environment
    
    if [ "$RUN_TESTS" = true ]; then
        run_tests --test
    fi
    
    # Deploy all functions
    if deploy_all_functions; then
        verify_deployments
        show_function_urls
        
        echo ""
        print_success "🚀 TCIS Edge Functions deployment completed successfully!"
        echo ""
        echo "Next steps:"
        echo "1. Set up required environment variables"
        echo "2. Test the endpoints using the provided curl examples"
        echo "3. Update your frontend to use the new function URLs"
        echo ""
    else
        print_error "❌ Deployment completed with errors. Please check the failed functions above."
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Deploy all TCIS Supabase Edge Functions"
    echo ""
    echo "Options:"
    echo "  --project-id ID    Supabase project ID (will prompt if not provided)"
    echo "  --test            Run tests before deployment"
    echo "  --help, -h        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Interactive deployment"
    echo "  $0 --project-id abc123def456          # Deploy with specific project ID"
    echo "  $0 --project-id abc123def456 --test   # Deploy with tests"
    echo ""
    echo "Prerequisites:"
    echo "  - Supabase CLI installed and logged in"
    echo "  - Run from project root directory"
    echo "  - Valid Supabase project with functions enabled"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
