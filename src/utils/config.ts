import { logger } from './logger.js';
import { SYSTEM_PROMPT } from '../config/prompt.js';

let promptVersion: string | null = null;

export async function loadPrompt(): Promise<{ prompt: string; version: string }> {
  // Generate version based on current timestamp if not already set
  if (!promptVersion) {
    promptVersion = `v${Date.now()}`;
  }

  logger.info('Prompt loaded successfully', { version: promptVersion });
  return { prompt: SYSTEM_PROMPT, version: promptVersion };
}

export function getConfig() {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_db',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
