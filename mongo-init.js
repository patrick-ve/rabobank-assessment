// MongoDB initialization script
// This script runs when the MongoDB container starts for the first time

db = db.getSiblingDB('chatbot_db');

// Create sessions collection with schema validation
db.createCollection('sessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['sessionId', 'promptVersion', 'messages', 'state', 'createdAt', 'updatedAt'],
      properties: {
        sessionId: {
          bsonType: 'string',
          description: 'Unique session identifier',
        },
        promptVersion: {
          bsonType: 'string',
          description: 'Version of the prompt used',
        },
        messages: {
          bsonType: 'array',
          description: 'Array of conversation messages',
          items: {
            bsonType: 'object',
            required: ['role', 'content', 'timestamp'],
            properties: {
              role: {
                enum: ['user', 'assistant', 'system'],
              },
              content: {
                bsonType: 'string',
              },
              timestamp: {
                bsonType: 'string',
              },
            },
          },
        },
        state: {
          enum: ['active', 'completed', 'cancelled'],
          description: 'Current state of the session',
        },
        createdAt: {
          bsonType: 'date',
          description: 'Session creation timestamp',
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Session last update timestamp',
        },
        completedAt: {
          bsonType: ['date', 'null'],
          description: 'Session completion timestamp',
        },
      },
    },
  },
});

// Create registrations collection with schema validation
db.createCollection('registrations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'sessionId',
        'promptVersion',
        'conversationData',
        'createdAt',
        'updatedAt',
      ],
      properties: {
        sessionId: {
          bsonType: 'string',
          description: 'Unique session identifier',
        },
        promptVersion: {
          bsonType: 'string',
          description: 'Version of the prompt used',
        },
        conversationData: {
          bsonType: 'object',
          description: 'Extracted data from conversation',
        },
        metadata: {
          bsonType: ['object', 'null'],
          description: 'Additional metadata',
        },
        createdAt: {
          bsonType: 'date',
          description: 'Registration creation timestamp',
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Registration last update timestamp',
        },
      },
    },
  },
});

// Create indexes for sessions
db.sessions.createIndex({ sessionId: 1 }, { unique: true });
db.sessions.createIndex({ state: 1 });
db.sessions.createIndex({ createdAt: -1 });

// Create indexes for registrations
db.registrations.createIndex({ sessionId: 1 }, { unique: true });
db.registrations.createIndex({ createdAt: -1 });

// Create text indexes for duplicate detection
db.registrations.createIndex(
  {
    'conversationData.name': 'text',
    'conversationData.licenseplate': 'text',
    'conversationData.license_plate': 'text',
  },
  {
    name: 'text_search_index',
    default_language: 'english',
  }
);

print('MongoDB initialization completed successfully');
print('Collections created: sessions, registrations');
print('Indexes created for performance and duplicate detection');
