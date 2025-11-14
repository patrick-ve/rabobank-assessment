import { generateText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { SessionRepository } from '../database/repositories/sessionRepository.js';
import { Message, ConversationData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { loadPrompt } from '../utils/config.js';
import { RegistrationDataSchema } from '../schemas/registrationSchema.js';

export class ConversationService {
  private sessionRepository: SessionRepository;
  private systemPrompt: string = '';
  private promptVersion: string = '';
  private openai: ReturnType<typeof createOpenAI>;

  constructor() {
    this.sessionRepository = new SessionRepository();
    this.openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async initialize() {
    const { prompt, version } = await loadPrompt();
    this.systemPrompt = prompt;
    this.promptVersion = version;
    logger.info('ConversationService initialized', { promptVersion: version });
  }

  async startConversation(sessionId: string): Promise<string> {
    // Create session in database
    await this.sessionRepository.createSession(sessionId, this.promptVersion);

    // Generate initial greeting from AI
    try {
      const { text } = await generateText({
        model: this.openai('gpt-5-nano'),
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: 'Hello, I would like to get a car insurance quote.',
          },
        ],
      });

      // Store initial messages
      const messages: Message[] = [
        {
          role: 'user',
          content: 'Hello, I would like to get a car insurance quote.',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
        },
      ];

      await this.sessionRepository.updateSessionMessages(sessionId, messages);

      return text;
    } catch (error) {
      logger.error('Error starting conversation', { error, sessionId });
      throw new Error('Failed to start conversation');
    }
  }

  async sendMessage(sessionId: string, userMessage: string): Promise<string> {
    try {
      // Get existing session
      const session = await this.sessionRepository.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.state !== 'active') {
        throw new Error('Session is not active');
      }

      // Add user message
      const newUserMessage: Message = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      };

      const messages = [...session.messages, newUserMessage];

      // Generate AI response
      const aiMessages = [
        { role: 'system' as const, content: this.systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const { text } = await generateText({
        model: this.openai('gpt-5-nano'),
        messages: aiMessages,
      });

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, assistantMessage];
      await this.sessionRepository.updateSessionMessages(sessionId, updatedMessages);

      return text;
    } catch (error) {
      logger.error('Error sending message', { error, sessionId });
      throw new Error('Failed to send message');
    }
  }

  async getSession(sessionId: string) {
    return await this.sessionRepository.getSession(sessionId);
  }

  async extractConversationData(sessionId: string): Promise<ConversationData> {
    try {
      const session = await this.sessionRepository.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Use AI to extract structured data from conversation
      const conversationText = session.messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const extractionPrompt = `
        Based on the following conversation, extract all the registration information that was collected.

        Conversation:
        ${conversationText}

        Extract the car information (type, manufacturer, year, license plate) and customer information (name, birthdate).
      `;

      // Use generateObject with Zod schema for structured extraction
      const { object: extractedData } = await generateObject({
        model: this.openai('gpt-5-nano'),
        schema: RegistrationDataSchema,
        prompt: extractionPrompt,
      });

      logger.info('Extracted structured conversation data', {
        sessionId,
        data: extractedData
      });

      // Convert to ConversationData format for backward compatibility
      return extractedData as ConversationData;
    } catch (error) {
      logger.error('Error extracting conversation data', { error, sessionId });
      throw new Error('Failed to extract conversation data');
    }
  }

  getPromptVersion(): string {
    return this.promptVersion;
  }
}
