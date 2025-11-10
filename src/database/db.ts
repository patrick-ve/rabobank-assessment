import { MongoClient, Db } from 'mongodb';
import { logger } from '../utils/logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function initDatabase(uri: string): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    });

    await client.connect();

    // Get database name from URI or use default
    const dbName = uri.split('/').pop()?.split('?')[0] || 'chatbot_db';
    db = client.db(dbName);

    logger.info('MongoDB connection initialized', { database: dbName });
    return db;
  } catch (error) {
    logger.error('Failed to initialize MongoDB connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB connection closed');
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const database = getDatabase();
    await database.admin().ping();
    logger.info('MongoDB connection test successful');
    return true;
  } catch (error) {
    logger.error('MongoDB connection test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
