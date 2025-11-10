import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedPrompt: string | null = null;
let promptVersion: string | null = null;

export async function loadPrompt(): Promise<{ prompt: string; version: string }> {
  if (cachedPrompt && promptVersion) {
    return { prompt: cachedPrompt, version: promptVersion };
  }

  try {
    const promptPath = path.join(__dirname, '../../config/prompt.txt');
    cachedPrompt = await fs.readFile(promptPath, 'utf-8');

    // Generate version based on content hash (simple approach)
    const stats = await fs.stat(promptPath);
    promptVersion = `v${stats.mtime.getTime()}`;

    logger.info('Prompt loaded successfully', { version: promptVersion });
    return { prompt: cachedPrompt, version: promptVersion };
  } catch (error) {
    logger.error('Error loading prompt', { error });
    throw new Error('Failed to load prompt configuration');
  }
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
