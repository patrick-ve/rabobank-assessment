# Architecture Documentation

## System Overview

The Rabobank AI Chatbot is a backend application that provides REST APIs for conducting AI-powered conversations to collect car insurance registration information.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Postman/Frontend)                │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP/REST
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                          H3 Web Server                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Routes Layer                       │  │
│  │  - POST /api/chat/start                                   │  │
│  │  - POST /api/chat/message                                 │  │
│  │  - POST /api/chat/complete                                │  │
│  │  - GET  /api/chat/session/:id                             │  │
│  │  - GET  /api/registrations                                │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │                  Service Layer                            │  │
│  │  ┌──────────────────────────┐  ┌─────────────────────┐  │  │
│  │  │  ConversationService     │  │ DuplicateDetection  │  │  │
│  │  │  - Start conversation    │  │ Service             │  │  │
│  │  │  - Send messages         │  │ - Detect duplicates │  │  │
│  │  │  - Extract data          │  │ - Hash PII          │  │  │
│  │  │  - Manage sessions       │  │ - Calculate score   │  │  │
│  │  └───────────┬──────────────┘  └──────────┬──────────┘  │  │
│  └──────────────┼────────────────────────────┼─────────────┘  │
│                 │                             │                 │
│  ┌──────────────▼─────────────────────────────▼─────────────┐  │
│  │              Repository Layer                             │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐  │  │
│  │  │  SessionRepository   │  │  RegistrationRepository  │  │  │
│  │  │  - CRUD sessions     │  │  - CRUD registrations    │  │  │
│  │  │  - Update messages   │  │  - Find similar records  │  │  │
│  │  └──────────┬───────────┘  └────────────┬─────────────┘  │  │
│  └─────────────┼──────────────────────────┼────────────────┘  │
└────────────────┼──────────────────────────┼───────────────────┘
                 │                           │
┌────────────────▼───────────────────────────▼───────────────────┐
│                    PostgreSQL Database                          │
│  ┌──────────────────────┐       ┌──────────────────────────┐  │
│  │   sessions table     │       │  registrations table     │  │
│  │  - session_id        │       │  - session_id            │  │
│  │  - prompt_version    │       │  - prompt_version        │  │
│  │  - messages (JSONB)  │       │  - conversation_data     │  │
│  │  - state             │       │    (JSONB)               │  │
│  └──────────────────────┘       │  - metadata (JSONB)      │  │
│                                  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       External Services                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              OpenAI API (via Vercel AI SDK)               │  │
│  │  - GPT-4 model for conversation                           │  │
│  │  - Text generation                                        │  │
│  │  - Data extraction                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Configuration                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    config/prompt.txt                      │  │
│  │  - System prompt for AI assistant                         │  │
│  │  - Loaded at startup                                      │  │
│  │  - Versioned automatically                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. API Layer (H3 Routes)

**Responsibility**: Handle HTTP requests and responses

**Components**:
- Route handlers in `src/api/routes/chat.ts`
- Error handling middleware
- Request validation

**Design Decisions**:
- Uses H3 framework for modern, lightweight routing
- Centralized error handling
- Type-safe request/response with TypeScript

### 2. Service Layer

#### ConversationService

**Responsibility**: Manage AI conversations

**Key Methods**:
- `initialize()`: Load prompt configuration
- `startConversation()`: Create new session with AI greeting
- `sendMessage()`: Process user messages and generate AI responses
- `extractConversationData()`: Extract structured data using AI

**Design Decisions**:
- Loads prompt once at startup for performance
- Stores complete conversation history
- Uses AI for data extraction (flexible to prompt changes)

#### DuplicateDetectionService

**Responsibility**: Detect duplicates without exposing PII

**Key Methods**:
- `detectDuplicate()`: Find similar registrations
- `hashSensitiveData()`: Hash PII fields
- `calculateHashMatchScore()`: Compare hashed data

**Design Decisions**:
- SHA-256 hashing for PII comparison
- PostgreSQL similarity functions for fuzzy matching
- Configurable similarity threshold
- Never returns PII in detection results

### 3. Repository Layer

#### SessionRepository

**Responsibility**: Data access for sessions

**Key Methods**:
- `createSession()`: Create new session
- `getSession()`: Retrieve session by ID
- `updateSessionMessages()`: Update conversation history
- `completeSession()`: Mark session as completed

#### RegistrationRepository

**Responsibility**: Data access for registrations

**Key Methods**:
- `createRegistration()`: Store completed registration
- `getAllRegistrations()`: List all registrations
- `findSimilarRegistrations()`: Find similar records using pg_trgm
- `updateRegistration()`: Update existing registration

**Design Decisions**:
- Uses parameterized queries to prevent SQL injection
- JSONB columns for flexible schema
- GIN indexes for fast JSONB queries
- pg_trgm extension for similarity matching

### 4. Database Layer

#### PostgreSQL with JSONB

**Tables**:

**sessions**:
- Tracks active conversations
- Stores message history as JSONB array
- State management (active/completed/cancelled)

**registrations**:
- Stores completed registrations
- JSONB for conversation data (flexible schema)
- Prompt version for historical tracking

**Design Decisions**:
- JSONB allows schema flexibility for changing prompts
- GIN indexes for performance
- Triggers for automatic timestamp updates
- pg_trgm extension for duplicate detection

### 5. External Services

#### OpenAI via Vercel AI SDK

**Usage**:
- Generate AI responses in conversations
- Extract structured data from text
- Natural language understanding

**Design Decisions**:
- Vercel AI SDK provides clean abstraction
- Easy to swap providers (OpenAI, Anthropic, etc.)
- Supports streaming (future enhancement)

## Data Flow

### Conversation Flow

```
1. Client → POST /api/chat/start
2. Generate sessionId
3. ConversationService.startConversation()
4. → OpenAI API (system prompt + greeting)
5. Store initial messages in sessions table
6. Return sessionId + greeting

7. Client → POST /api/chat/message (with sessionId)
8. Retrieve session from database
9. ConversationService.sendMessage()
10. → OpenAI API (full conversation context)
11. Append messages to session
12. Return AI response

13. Repeat steps 7-12 until information collected

14. Client → POST /api/chat/complete
15. ConversationService.extractConversationData()
16. → OpenAI API (extract structured data)
17. DuplicateDetectionService.detectDuplicate()
18. Query database for similar records
19. If duplicate → return confirmation required
20. If no duplicate → create registration
21. Mark session as completed
22. Return success
```

### Duplicate Detection Flow

```
1. Receive conversation data
2. Hash sensitive fields (name, birthdate, license plate)
3. Query database with PostgreSQL similarity function
4. For each similar record:
   - Hash its sensitive fields
   - Compare hash matches
   - Calculate similarity score
5. If score > threshold → duplicate found
6. Return result (without exposing PII)
```

## Security Considerations

### PII Protection

- Sensitive data hashed before comparison
- No PII in API responses for duplicate detection
- Database access controlled by repositories
- Environment variables for credentials

### Input Validation

- Type checking with TypeScript
- Request validation with Zod
- Parameterized SQL queries
- Error messages don't leak sensitive info

### API Security (Future Enhancements)

- [ ] API key authentication
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] Request signing
- [ ] TLS/HTTPS enforcement

## Scalability Considerations

### Current Design

- Connection pooling for database
- Stateless API (sessions in database)
- Docker containerization
- Horizontal scaling ready

### Future Optimizations

- [ ] Redis caching for sessions
- [ ] Message queuing for async processing
- [ ] Read replicas for database
- [ ] CDN for static content
- [ ] Load balancing
- [ ] Kubernetes deployment

## Error Handling

### Strategy

1. **Service Layer**: Throw descriptive errors
2. **Repository Layer**: Log and throw data access errors
3. **API Layer**: Catch all errors, log, return user-friendly messages
4. **Global Handler**: Catch unhandled errors

### Error Types

- `400 Bad Request`: Invalid input
- `404 Not Found`: Session/resource not found
- `500 Internal Server Error`: Unexpected errors

## Monitoring & Observability

### Current Implementation

- Winston logger with structured logging
- Request/response logging
- Error logging with stack traces
- Database connection monitoring

### Future Enhancements

- [ ] Prometheus metrics
- [ ] Distributed tracing (OpenTelemetry)
- [ ] APM integration
- [ ] Health check endpoints with details
- [ ] Alerting system

## Testing Strategy

### Unit Tests

- Service layer logic
- Repository layer (with test database)
- Utility functions

### Integration Tests

- API endpoints
- Database operations
- External API mocking

### E2E Tests

- Complete conversation flows
- Duplicate detection scenarios
- Error handling

## Deployment Architecture

### Docker Compose (Development/Testing)

```
┌─────────────────────────────────────┐
│        Docker Host                  │
│  ┌──────────────────────────────┐  │
│  │   rabobank-chatbot:3000      │  │
│  │   (Application Container)     │  │
│  └────────────┬─────────────────┘  │
│               │                     │
│  ┌────────────▼─────────────────┐  │
│  │   postgres:5432              │  │
│  │   (Database Container)        │  │
│  │   + persistent volume         │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Production (Kubernetes - Future)

```
┌──────────────────────────────────────────────────┐
│                 Load Balancer                    │
└────────────┬─────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────┐
│           Kubernetes Cluster                     │
│  ┌────────────────────────────────────────────┐ │
│  │        App Pods (replicas: 3)              │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐   │ │
│  │  │  Pod 1  │  │  Pod 2  │  │  Pod 3  │   │ │
│  │  └─────────┘  └─────────┘  └─────────┘   │ │
│  └────────────────────────────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼──────────────────────┐  │
│  │     PostgreSQL StatefulSet                │  │
│  │     + Persistent Volume Claim             │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

## Configuration Management

### Environment-Based Configuration

- `.env` files for local development
- Environment variables in containers
- Secrets management in production
- Config maps for non-sensitive data

### Prompt Versioning

- Prompt stored in `config/prompt.txt`
- Version generated from file modification time
- Each registration linked to prompt version
- Historical data preserved across changes

## Design Patterns Used

1. **Repository Pattern**: Data access abstraction
2. **Service Layer Pattern**: Business logic separation
3. **Dependency Injection**: Service composition
4. **Factory Pattern**: Database connection management
5. **Strategy Pattern**: Duplicate detection algorithms

## Technical Debt & Future Work

### Known Limitations

1. Single LLM provider (OpenAI)
2. No authentication/authorization
3. Limited rate limiting
4. No caching layer
5. Synchronous processing only

### Planned Improvements

1. Multi-provider LLM support
2. JWT-based authentication
3. Redis caching
4. Async message processing
5. GraphQL API option
6. Advanced analytics
7. Conversation export
8. GDPR compliance features

## Conclusion

The architecture prioritizes:
- **Flexibility**: JSONB schema, dynamic prompts
- **Privacy**: Hash-based duplicate detection
- **Maintainability**: Clean separation of concerns
- **Scalability**: Stateless design, containerization
- **Reliability**: PostgreSQL ACID compliance, error handling
