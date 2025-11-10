import { H3Error } from 'h3';
import { logger } from '../../utils/logger.js';

export function createErrorResponse(error: unknown, statusCode: number = 500) {
  if (error instanceof H3Error) {
    logger.error('H3 Error', { statusCode: error.statusCode, message: error.message });
    return {
      error: {
        message: error.message,
        statusCode: error.statusCode,
      },
    };
  }

  if (error instanceof Error) {
    logger.error('Error', { message: error.message, stack: error.stack });
    return {
      error: {
        message: error.message,
        statusCode,
      },
    };
  }

  logger.error('Unknown error', { error });
  return {
    error: {
      message: 'An unexpected error occurred',
      statusCode,
    },
  };
}
