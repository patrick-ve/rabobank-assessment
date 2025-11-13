# Rabobank AI Chatbot - Programming Assignment

An AI-powered chatbot backend for car insurance registration with duplicate detection capabilities.

## Features

- **AI-Powered Conversations**: Uses Vercel AI SDK with GPT-5 for natural language interactions
- **Structured Data Extraction**: Zod schema validation with `generateObject` for guaranteed type-safe extraction
- **AI-Based Duplicate Detection**: Semantic similarity using OpenAI embeddings instead of simple hash comparison
  - 85% similarity threshold for intelligent duplicate detection
  - Cosine similarity calculation between embedding vectors
  - Fallback to exact license plate matching for safety
  - Human-readable explanations of why duplicates were detected
- **Dynamic Prompt System**: Loads prompts from configuration files, allowing flexible conversation flows
- **Flexible Schema**: MongoDB's document model supports changing prompts without schema migrations
- **REST API**: Clean H3-based API for easy integration
- **Docker Support**: Full containerization with Docker Compose

## Technology Stack

- **Runtime**: Node.js 24.11.0 LTS
- **Language**: TypeScript (strict mode)
- **Framework**: H3 Web Framework
- **AI SDK**: Vercel AI SDK with OpenAI GPT-5 and text-embedding-3-small
- **Validation**: Zod for schema validation and type inference
- **Database**: MongoDB 7
- **Testing**: Vitest
- **Containerization**: Docker & Docker Compose

## Project Structure

```
.
├── src/
│   ├── api/
│   │   ├── middleware/      # Error handling middleware
│   │   └── routes/          # API route handlers
│   ├── database/
│   │   ├── db.ts            # Database connection
│   │   └── repositories/    # Data access layer
│   ├── schemas/             # Zod schemas
│   │   └── registrationSchema.ts
│   ├── services/            # Business logic
│   │   ├── conversationService.ts
│   │   ├── duplicateDetectionService.ts
│   │   └── embeddingService.ts
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utilities (logger, config)
│   └── index.ts             # Application entry point
├── config/
│   └── prompt.txt           # AI assistant prompt
├── tests/
│   └── e2e/                 # End-to-end tests
├── Dockerfile               # Multi-stage Docker build
├── docker-compose.yml       # Container orchestration
├── mongo-init.js            # MongoDB initialization
└── build.sh                 # Build automation script
```

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- OpenAI API key

### 1. Clone and Configure

```bash
# Copy environment variables
cp .env.example .env

# Edit .env and add your OpenAI API key
OPENAI_API_KEY=your_key_here
```

### 2. Build and Run

```bash
# Option A: Use the build script (recommended)
./build.sh

# Option B: Manual build
npm install
npm run build
docker-compose up
```

### 3. Test the API

The application will be available at `http://localhost:3000`

#### Health Check
```bash
curl http://localhost:3000/health
```

#### Complete Conversation Flow

**1. Start a new chat session:**
```bash
curl -X POST http://localhost:3000/api/chat/start
```

Response:
```json
{
  "sessionId": "abc123...",
  "message": "Hello! Welcome to our car insurance registration..."
}
```

**2. Send messages:**
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc123...",
    "message": "I have a Sedan, Toyota from 2020"
  }'
```

**3. Continue the conversation until all information is collected**

**4. Complete the registration:**
```bash
curl -X POST http://localhost:3000/api/chat/complete \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc123..."
  }'
```

**5. View all registrations:**
```bash
curl http://localhost:3000/api/registrations
```

## API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/chat/start` | Start new conversation |
| POST | `/api/chat/message` | Send message in conversation |
| POST | `/api/chat/complete` | Complete and save registration |
| GET | `/api/chat/session/:id` | Get session details |
| GET | `/api/registrations` | List all registrations |

### Request/Response Examples

#### POST /api/chat/message
Request:
```json
{
  "sessionId": "abc123",
  "message": "I drive a Honda Civic from 2019"
}
```

Response:
```json
{
  "sessionId": "abc123",
  "message": "Great! What is the license plate number?"
}
```

#### POST /api/chat/complete
Request:
```json
{
  "sessionId": "abc123"
}
```

Response (Success):
```json
{
  "success": true,
  "message": "Registration completed successfully. Thank you!",
  "registrationId": "uuid-here",
  "duplicateDetected": false
}
```

Response (Duplicate Detected):
```json
{
  "success": false,
  "message": "A similar registration was found...",
  "duplicateDetected": true,
  "duplicateConfirmationRequired": true
}
```

## Configuration

### Prompt Configuration

Edit `config/prompt.txt` to customize the AI assistant's behavior:

```
You are an AI Assistant, that works at registration office...
```

The system automatically:
- Loads the prompt at startup
- Tracks prompt versions
- Preserves historical data across prompt changes

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | See .env.example |
| `OPENAI_API_KEY` | OpenAI API key (GPT-5 access required) | Required |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |

## Development

### Run in Development Mode

```bash
npm install
npm run dev
```

### Run Tests

```bash
# Make sure MongoDB is running
docker-compose up mongodb -d

# Run tests
npm test

# Run with coverage
npm run test -- --coverage
```

### Lint and Format

```bash
npm run lint
npm run format
```

## Database Schema

The application uses MongoDB with flexible document collections:

### Collections

**sessions**: Tracks active conversations
- `_id`: ObjectId primary key
- `sessionId`: Unique session identifier
- `promptVersion`: Version of prompt used
- `messages`: Array of conversation messages
- `state`: Session state (active/completed/cancelled)
- `createdAt`, `updatedAt`, `completedAt`: Timestamps

**registrations**: Stores completed registrations
- `_id`: ObjectId primary key
- `sessionId`: Reference to session
- `promptVersion`: Version of prompt used
- `conversationData`: Document with extracted registration data (validated with Zod)
- `metadata`: Document with additional metadata
- `embedding`: AI-generated embedding vector for similarity detection
  - `vector`: Array of numbers from text-embedding-3-small model
  - `model`: Model used for embedding generation
  - `createdAt`: Embedding generation timestamp
- `createdAt`, `updatedAt`: Timestamps

### Duplicate Detection

The system uses AI-based semantic similarity detection:
- **OpenAI Embeddings**: Generates vector representations using text-embedding-3-small
- **Cosine Similarity**: Calculates similarity between embedding vectors
- **85% Threshold**: Configurable similarity threshold for duplicate detection
- **Smart Matching**: Recognizes semantic equivalents (e.g., "John Doe" ≈ "J. Doe")
- **License Plate Fallback**: Exact matching for critical fields
- **Privacy-Preserving**: No PII exposed in similarity calculations
- **Explainable Results**: Provides human-readable explanations of why duplicates were detected

## Docker

### Build Docker Image

```bash
docker build -t rabobank-ai-chatbot .
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Docker Compose Services

- **mongodb**: MongoDB database with persistent storage
- **app**: Node.js application container

## Testing Strategy

The project includes comprehensive E2E tests:

- Complete conversation flow
- Data extraction and storage
- Session management
- Registration retrieval

Tests use Vitest and can run against a test database.

## Design Decisions

### Why MongoDB?

- **Flexibility**: Document model allows schema changes without migrations
- **Performance**: Native JSON support, efficient indexing
- **Scalability**: Horizontal scaling built-in
- **Simplicity**: Easy setup and deployment (as recommended in assignment FAQ)

### Why H3 Framework?

- **Modern**: Built for the edge and serverless
- **Lightweight**: Minimal overhead
- **Type-safe**: Excellent TypeScript support
- **Fast**: High performance routing

### Why Zod for Data Extraction?

- **Type Safety**: Schema validation at runtime with TypeScript inference
- **Structured Output**: Works with Vercel AI SDK's `generateObject` for guaranteed structure
- **No Regex Parsing**: Eliminates fragile JSON extraction from AI responses
- **Validation**: Automatic validation of dates, enums, and field constraints

### Why AI-Based Duplicate Detection?

- **Semantic Understanding**: Detects duplicates even with variations (e.g., "John Doe" ≈ "J. Doe")
- **Better Accuracy**: 85% similarity threshold vs binary hash matching
- **Flexibility**: Handles typos, abbreviations, and format variations
- **Explainability**: Can provide reasons why something is considered a duplicate

### Duplicate Detection Approach

1. **Generate embeddings** for each registration using OpenAI's text-embedding-3-small
2. **Calculate cosine similarity** between embedding vectors
3. **Apply 85% threshold** to identify potential duplicates
4. **Fallback to exact matching** for critical fields like license plates
5. **Generate explanations** about what fields matched
6. **Never expose PII** in comparison results
7. **Require user confirmation** before updates

### Prompt Versioning

Each registration stores the prompt version used, allowing:
- Historical data preservation
- Prompt evolution tracking
- Data migration if needed

## Deployment

### Prerequisites

- Docker-capable infrastructure
- MongoDB database (or use provided Docker setup)
- OpenAI API access

### Deployment Steps

1. Build the Docker image: `./build.sh`
2. Push image to registry (optional)
3. Deploy with docker-compose or Kubernetes
4. Set environment variables
5. Run database migrations (automatic via init.sql)

### Environment Setup

```bash
# Production environment
export NODE_ENV=production
export MONGODB_URI=mongodb://user:pass@host:27017/chatbot_db?authSource=admin
export OPENAI_API_KEY=sk-...
export PORT=3000
```

## Troubleshooting

### Database Connection Issues

```bash
# Check MongoDB is running
docker-compose ps

# View database logs
docker-compose logs mongodb

# Test connection manually
docker-compose exec mongodb mongosh -u chatbot -p chatbot_password --authenticationDatabase admin chatbot_db
```

### Application Issues

```bash
# View application logs
docker-compose logs app

# Check health endpoint
curl http://localhost:3000/health
```

### Test Failures

```bash
# Ensure database is running
docker-compose up mongodb -d

# Wait for database to be ready
sleep 5

# Run tests
npm test
```

## Future Improvements

- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add conversation timeout handling
- [ ] Support multiple LLM providers
- [ ] Add conversation export functionality
- [ ] Implement soft deletes for GDPR compliance
- [ ] Add GraphQL API option
- [ ] Implement caching layer (Redis)
- [ ] Add metrics and monitoring (Prometheus)
- [ ] Support multi-language prompts

## License

This project is part of the Rabobank programming assignment.

## Support

For questions or issues related to the assignment, please contact the Rabobank recruitment team.
