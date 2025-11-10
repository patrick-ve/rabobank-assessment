import { createServer } from 'http';
import {
  createApp,
  createRouter,
  eventHandler,
  toNodeListener,
  setResponseStatus,
} from 'h3';
import dotenv from 'dotenv';
import { initDatabase, testConnection } from './database/db.js';
import { logger } from './utils/logger.js';
import { getConfig } from './utils/config.js';
import { createErrorResponse } from './api/middleware/errorHandler.js';
import {
  handleChatStart,
  handleChatMessage,
  handleChatComplete,
  handleGetSession,
  handleGetRegistrations,
} from './api/routes/chat.js';

// Load environment variables
dotenv.config();

const config = getConfig();

// Create H3 app
const app = createApp({
  onError: (error, event) => {
    setResponseStatus(event, 500);
    return createErrorResponse(error);
  },
});

// Create router
const router = createRouter();

// Health check endpoint
router.get(
  '/health',
  eventHandler(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  })
);

// Chat endpoints
router.post(
  '/api/chat/start',
  eventHandler(async (event) => {
    try {
      return await handleChatStart(event);
    } catch (error) {
      setResponseStatus(event, 400);
      return createErrorResponse(error, 400);
    }
  })
);

router.post(
  '/api/chat/message',
  eventHandler(async (event) => {
    try {
      return await handleChatMessage(event);
    } catch (error) {
      setResponseStatus(event, 400);
      return createErrorResponse(error, 400);
    }
  })
);

router.post(
  '/api/chat/complete',
  eventHandler(async (event) => {
    try {
      return await handleChatComplete(event);
    } catch (error) {
      setResponseStatus(event, 400);
      return createErrorResponse(error, 400);
    }
  })
);

router.get(
  '/api/chat/session/:id',
  eventHandler(async (event) => {
    try {
      return await handleGetSession(event);
    } catch (error) {
      setResponseStatus(event, 404);
      return createErrorResponse(error, 404);
    }
  })
);

router.get(
  '/api/registrations',
  eventHandler(async (event) => {
    try {
      return await handleGetRegistrations(event);
    } catch (error) {
      setResponseStatus(event, 500);
      return createErrorResponse(error, 500);
    }
  })
);

// Add router to app
app.use(router);

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    logger.info('Initializing MongoDB connection...');
    await initDatabase(config.mongodbUri);

    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to MongoDB');
    }

    // Create HTTP server
    const server = createServer(toNodeListener(app));

    // Start listening
    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
      });
      logger.info('Available endpoints:');
      logger.info('  - GET  /health');
      logger.info('  - POST /api/chat/start');
      logger.info('  - POST /api/chat/message');
      logger.info('  - POST /api/chat/complete');
      logger.info('  - GET  /api/chat/session/:id');
      logger.info('  - GET  /api/registrations');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer();
