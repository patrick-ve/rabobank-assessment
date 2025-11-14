#!/bin/bash

# Run E2E tests with performance optimizations - 5 TESTS IN PARALLEL

echo "🚀 Running ALL E2E tests with 5 tests in parallel..."
echo ""

# Load main .env file first to get OPENAI_API_KEY
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Set test environment variables (these override test-specific settings)
export TEST_EMBEDDING_MODEL="text-embedding-3-small"
export TEST_SIMILARITY_THRESHOLD="0.80"
export NODE_ENV="test"

# Use a separate test database to avoid conflicts
export MONGODB_URI="mongodb://chatbot:chatbot_password@localhost:27017/chatbot_test_db?authSource=admin"

# Clear test database before running tests (optional)
echo "📦 Clearing test database..."
docker exec -it $(docker ps -qf "name=mongodb") mongosh chatbot_test_db --username chatbot --password chatbot_password --authenticationDatabase admin --eval "db.dropDatabase()" 2>/dev/null || true

# Run ALL tests with 5 running concurrently
echo "🧪 Starting test execution (all tests, 5 concurrent)..."
echo "⚡ Tests marked with .concurrent will run in parallel (max 5 at once)"
echo ""
npm test -- --reporter=verbose --run --max-concurrency=5

echo ""
echo "✅ Tests completed!"