import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { SessionRepository } from '../database/repositories/sessionRepository.js';
import { Message, ConversationData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { loadPrompt } from '../utils/config.js';

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
        model: this.openai('gpt-4o-mini'),
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
        model: this.openai('gpt-4o-mini'),
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
        Based on the following conversation, extract all the information that was collected.
        Return ONLY a valid JSON object with the extracted fields.

        Conversation:
        ${conversationText}

        Extract fields like: car type, manufacturer, year, license plate, customer name, birthdate, etc.
        Return only JSON, no other text.
      `;

      const { text } = await generateText({
        model: this.openai('gpt-4o-mini'),
        messages: [
          {
            role: 'user',
            content: extractionPrompt,
          },
        ],
      });

      // Parse the JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedData = JSON.parse(jsonMatch[0]);
        logger.info('Extracted conversation data', { sessionId, data: extractedData });
        return extractedData;
      }

      logger.warn('Could not extract structured data from conversation', { sessionId });
      return {};
    } catch (error) {
      logger.error('Error extracting conversation data', { error, sessionId });
      throw new Error('Failed to extract conversation data');
    }
  }

  getPromptVersion(): string {
    return this.promptVersion;
  }
}
