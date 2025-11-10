import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDatabase, closeDatabaseConnection, testConnection } from '../../src/database/db.js';
import { ConversationService } from '../../src/services/conversationService.js';
import { RegistrationRepository } from '../../src/database/repositories/registrationRepository.js';
import { nanoid } from 'nanoid';

describe('Chat E2E Test', () => {
  let conversationService: ConversationService;
  let registrationRepository: RegistrationRepository;

  beforeAll(async () => {
    // Initialize database connection for testing
    const mongodbUri =
      process.env.MONGODB_URI ||
      'mongodb://chatbot:chatbot_password@localhost:27017/chatbot_db?authSource=admin';
    await initDatabase(mongodbUri);

    // Test connection
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('MongoDB connection failed');
    }

    conversationService = new ConversationService();
    await conversationService.initialize();

    registrationRepository = new RegistrationRepository();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it('should complete a full conversation flow', async () => {
    const sessionId = nanoid();

    // Step 1: Start conversation
    const initialMessage = await conversationService.startConversation(sessionId);
    expect(initialMessage).toBeTruthy();
    expect(typeof initialMessage).toBe('string');

    // Step 2: Send messages simulating a customer providing information
    const response1 = await conversationService.sendMessage(
      sessionId,
      'I have a Sedan, it is a Toyota from 2020.'
    );
    expect(response1).toBeTruthy();

    const response2 = await conversationService.sendMessage(
      sessionId,
      'The license plate is ABC-123.'
    );
    expect(response2).toBeTruthy();

    const response3 = await conversationService.sendMessage(
      sessionId,
      'My name is John Doe and I was born on 1990-05-15.'
    );
    expect(response3).toBeTruthy();

    // Step 3: Extract conversation data
    const conversationData = await conversationService.extractConversationData(sessionId);
    expect(conversationData).toBeTruthy();
    expect(Object.keys(conversationData).length).toBeGreaterThan(0);

    // Step 4: Create registration
    const registration = await registrationRepository.createRegistration(
      sessionId,
      conversationService.getPromptVersion(),
      conversationData,
      {
        testRun: true,
        completedAt: new Date().toISOString(),
      }
    );

    expect(registration).toBeTruthy();
    expect(registration.id).toBeTruthy();
    expect(registration.sessionId).toBe(sessionId);
    expect(registration.conversationData).toEqual(conversationData);
  }, 60000);

  it('should retrieve session information', async () => {
    const sessionId = nanoid();

    // Start conversation
    await conversationService.startConversation(sessionId);

    // Send a message
    await conversationService.sendMessage(sessionId, 'Hello, I need insurance.');

    // Get session
    const session = await conversationService.getSession(sessionId);

    expect(session).toBeTruthy();
    expect(session?.sessionId).toBe(sessionId);
    expect(session?.messages.length).toBeGreaterThan(0);
    expect(session?.state).toBe('active');
  });

  it('should retrieve all registrations', async () => {
    const registrations = await registrationRepository.getAllRegistrations();
    expect(Array.isArray(registrations)).toBe(true);
  });
});
