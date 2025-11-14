import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDatabase, closeDatabaseConnection, testConnection } from '../../src/database/db.js';
import { ConversationService } from '../../src/services/conversationService.js';
import { RegistrationRepository } from '../../src/database/repositories/registrationRepository.js';
import { DuplicateDetectionService } from '../../src/services/duplicateDetectionService.js';
import { nanoid } from 'nanoid';

describe.concurrent('Chat E2E Test', () => {
  let conversationService: ConversationService;
  let registrationRepository: RegistrationRepository;
  let duplicateDetectionService: DuplicateDetectionService;
  let testPrefix: string;

  beforeAll(async () => {
    // Create unique test prefix to avoid conflicts between parallel tests
    testPrefix = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const mongodbUri =
      process.env.MONGODB_URI ||
      'mongodb://chatbot:chatbot_password@localhost:27017/chatbot_db?authSource=admin';
    await initDatabase(mongodbUri);

    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('MongoDB connection failed');
    }

    conversationService = new ConversationService();
    await conversationService.initialize();

    registrationRepository = new RegistrationRepository();
    duplicateDetectionService = new DuplicateDetectionService();
  });

  afterAll(async () => {
    // Clean up test data created with this test prefix
    try {
      const db = (await import('../../src/database/db.js')).getDatabase();
      await db.collection('sessions').deleteMany({ sessionId: { $regex: `^${testPrefix}` } });
      await db.collection('registrations').deleteMany({ sessionId: { $regex: `^${testPrefix}` } });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    await closeDatabaseConnection();
  });

  it.concurrent('should complete a full conversation flow', async () => {
    const sessionId = `${testPrefix}_${nanoid()}`;

    const initialMessage = await conversationService.startConversation(sessionId);
    expect(initialMessage).toBeTruthy();
    expect(typeof initialMessage).toBe('string');

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

    const conversationData = await conversationService.extractConversationData(sessionId);
    expect(conversationData).toBeTruthy();
    expect(Object.keys(conversationData).length).toBeGreaterThan(0);

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
  }, 120000);

  it.concurrent('should retrieve session information', async () => {
    const sessionId = `${testPrefix}_${nanoid()}`;

    await conversationService.startConversation(sessionId);

    await conversationService.sendMessage(sessionId, 'Hello, I need insurance.');

    const session = await conversationService.getSession(sessionId);

    expect(session).toBeTruthy();
    expect(session?.sessionId).toBe(sessionId);
    expect(session?.messages.length).toBeGreaterThan(0);
    expect(session?.state).toBe('active');
  });

  it.concurrent('should retrieve all registrations', async () => {
    const registrations = await registrationRepository.getAllRegistrations();
    expect(Array.isArray(registrations)).toBe(true);
  });

  it.concurrent('should generate embeddings when creating registration', async () => {
    const sessionId = `${testPrefix}_${nanoid()}`;

    await conversationService.startConversation(sessionId);
    await conversationService.sendMessage(sessionId, 'Honda Civic Sedan from 2019');
    await conversationService.sendMessage(sessionId, 'License plate is XYZ-789');
    await conversationService.sendMessage(sessionId, 'My name is Jane Smith, born 1990-03-20');

    const conversationData = await conversationService.extractConversationData(sessionId);
    expect(conversationData).toBeTruthy();

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

    expect(registration.embedding).toBeTruthy();
    expect(registration.embedding?.vector).toBeTruthy();
    expect(Array.isArray(registration.embedding?.vector)).toBe(true);
    expect(registration.embedding?.vector.length).toBe(1536);
    expect(registration.embedding?.model).toBe('text-embedding-3-small');
    expect(registration.embedding?.createdAt).toBeTruthy();
  }, 120000);

  it.concurrent('should detect duplicate registration using AI embeddings', async () => {
    const sessionId1 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId1);
    await conversationService.sendMessage(sessionId1, 'Honda Civic Sedan from 2019');
    await conversationService.sendMessage(sessionId1, 'License plate XYZ-789');
    await conversationService.sendMessage(sessionId1, 'Jane Smith, born 1990-03-20');

    const conversationData1 = await conversationService.extractConversationData(sessionId1);
    const registration1 = await registrationRepository.createRegistration(
      sessionId1,
      conversationService.getPromptVersion(),
      conversationData1,
      { testRun: true, completedAt: new Date().toISOString() }
    );

    expect(registration1).toBeTruthy();
    expect(registration1.embedding).toBeTruthy();

    const sessionId2 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId2);
    await conversationService.sendMessage(sessionId2, 'Honda Civic 2019, license XYZ-789');
    await conversationService.sendMessage(sessionId2, 'Jane Smith, 1990-03-20');

    const conversationData2 = await conversationService.extractConversationData(sessionId2);

    const duplicateResult = await duplicateDetectionService.detectDuplicate(conversationData2);

    expect(duplicateResult.isDuplicate).toBe(true);
    expect(duplicateResult.requiresConfirmation).toBe(true);
    expect(duplicateResult.similarityScore).toBeGreaterThan(0.85);
    expect(duplicateResult.existingRegistrationId).toBe(registration1.id);
  }, 120000);

  it.concurrent('should not detect duplicate for different registrations', async () => {
    const sessionId1 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId1);
    await conversationService.sendMessage(sessionId1, 'Honda Civic Sedan 2019, XYZ-789');
    await conversationService.sendMessage(sessionId1, 'Jane Smith, 1990-03-20');

    const conversationData1 = await conversationService.extractConversationData(sessionId1);
    await registrationRepository.createRegistration(
      sessionId1,
      conversationService.getPromptVersion(),
      conversationData1,
      { testRun: true, completedAt: new Date().toISOString() }
    );

    const sessionId2 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId2);
    await conversationService.sendMessage(sessionId2, 'Ford Transit Minivan 2021, AAA-111');
    await conversationService.sendMessage(sessionId2, 'Bob Johnson, 1985-12-01');

    const conversationData2 = await conversationService.extractConversationData(sessionId2);

    const duplicateResult = await duplicateDetectionService.detectDuplicate(conversationData2);

    expect(duplicateResult.isDuplicate).toBe(false);
    expect(duplicateResult.requiresConfirmation).toBe(false);
    expect(duplicateResult.existingRegistrationId).toBeUndefined();
  }, 120000);

  it.concurrent('should detect duplicate by exact license plate match as fallback', async () => {
    const sessionId1 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId1);
    await conversationService.sendMessage(sessionId1, 'Toyota Camry 2020, plate TEST-999');
    await conversationService.sendMessage(sessionId1, 'Alice Brown, 1988-06-15');

    const conversationData1 = await conversationService.extractConversationData(sessionId1);
    await registrationRepository.createRegistration(
      sessionId1,
      conversationService.getPromptVersion(),
      conversationData1,
      { testRun: true, completedAt: new Date().toISOString() }
    );

    const sessionId2 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId2);
    await conversationService.sendMessage(sessionId2, 'Tesla Model 3 2023, plate TEST-999');
    await conversationService.sendMessage(sessionId2, 'Charlie Davis, 1995-09-30');

    const conversationData2 = await conversationService.extractConversationData(sessionId2);

    const duplicateResult = await duplicateDetectionService.detectDuplicate(conversationData2);

    expect(duplicateResult.isDuplicate).toBe(true);
    expect(duplicateResult.requiresConfirmation).toBe(true);
  }, 120000);

  it.concurrent('should never expose PII in duplicate detection results', async () => {
    const sessionId1 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId1);
    await conversationService.sendMessage(sessionId1, 'Honda Civic Sedan 2019, XYZ-789');
    await conversationService.sendMessage(sessionId1, 'John Smith, 1990-03-20');

    const conversationData1 = await conversationService.extractConversationData(sessionId1);
    await registrationRepository.createRegistration(
      sessionId1,
      conversationService.getPromptVersion(),
      conversationData1,
      { testRun: true, completedAt: new Date().toISOString() }
    );

    const sessionId2 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId2);
    await conversationService.sendMessage(sessionId2, 'Honda Civic 2019, license XYZ-789');
    await conversationService.sendMessage(sessionId2, 'John Smith, 1990-03-20');

    const conversationData2 = await conversationService.extractConversationData(sessionId2);
    const duplicateResult = await duplicateDetectionService.detectDuplicate(conversationData2);

    expect(duplicateResult.isDuplicate).toBe(true);
    expect(duplicateResult.requiresConfirmation).toBe(true);

    const resultJson = JSON.stringify(duplicateResult);
    expect(resultJson).not.toContain('John');
    expect(resultJson).not.toContain('Smith');
    expect(resultJson).not.toContain('1990');
    expect(resultJson).not.toContain('03-20');
    expect(resultJson).not.toContain('birthdate');
    expect(resultJson).not.toContain('customer name');
    expect(resultJson).not.toContain('name');

    expect(duplicateResult).toHaveProperty('isDuplicate');
    expect(duplicateResult).toHaveProperty('requiresConfirmation');
    expect(duplicateResult).toHaveProperty('similarityScore');
    expect(duplicateResult).toHaveProperty('existingRegistrationId');

    expect(duplicateResult).not.toHaveProperty('explanation');
    expect(duplicateResult).not.toHaveProperty('matchedFields');
    expect(duplicateResult).not.toHaveProperty('customerData');
  }, 120000);

  it.concurrent('should generate proper confirmation message without exposing PII', async () => {
    const confirmationMessage = duplicateDetectionService.generateConfirmationMessage();

    expect(confirmationMessage).toBeTruthy();
    expect(typeof confirmationMessage).toBe('string');

    expect(confirmationMessage).toContain('similar registration');

    expect(confirmationMessage.toLowerCase()).toMatch(/confirm|update|yes/);

    expect(confirmationMessage).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(confirmationMessage).not.toMatch(/\b[A-Z]{2,3}-\d{3}\b/);
    expect(confirmationMessage).not.toMatch(/\bJohn\b|\bJane\b|\bSmith\b/i);
  });

  it.concurrent('should handle user confirmation flow for duplicate registration', async () => {
    const sessionId1 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId1);
    await conversationService.sendMessage(sessionId1, 'BMW 320i Sedan 2020, ABC-999');
    await conversationService.sendMessage(sessionId1, 'David Wilson, 1985-08-10');

    const conversationData1 = await conversationService.extractConversationData(sessionId1);
    const registration1 = await registrationRepository.createRegistration(
      sessionId1,
      conversationService.getPromptVersion(),
      conversationData1,
      { testRun: true, completedAt: new Date().toISOString() }
    );

    const sessionId2 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId2);
    await conversationService.sendMessage(sessionId2, 'BMW 320i 2020, license ABC-999');
    await conversationService.sendMessage(sessionId2, 'David Wilson, 1985-08-10');

    const conversationData2 = await conversationService.extractConversationData(sessionId2);
    const duplicateResult = await duplicateDetectionService.detectDuplicate(conversationData2);

    expect(duplicateResult.isDuplicate).toBe(true);
    expect(duplicateResult.requiresConfirmation).toBe(true);

    const confirmMessage = await conversationService.sendMessage(sessionId2, 'yes, please update');

    expect(confirmMessage.toLowerCase()).toMatch(/update|confirm|acknowledge/);
  }, 120000);

  it.concurrent('should handle user rejection flow for duplicate registration', async () => {
    const sessionId1 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId1);
    await conversationService.sendMessage(sessionId1, 'Mercedes C-Class 2021, DEF-456');
    await conversationService.sendMessage(sessionId1, 'Emma Johnson, 1992-12-25');

    const conversationData1 = await conversationService.extractConversationData(sessionId1);
    await registrationRepository.createRegistration(
      sessionId1,
      conversationService.getPromptVersion(),
      conversationData1,
      { testRun: true, completedAt: new Date().toISOString() }
    );

    const sessionId2 = `${testPrefix}_${nanoid()}`;
    await conversationService.startConversation(sessionId2);
    await conversationService.sendMessage(sessionId2, 'Mercedes C-Class 2021, DEF-456');
    await conversationService.sendMessage(sessionId2, 'Emma Johnson, 1992-12-25');

    const conversationData2 = await conversationService.extractConversationData(sessionId2);
    const duplicateResult = await duplicateDetectionService.detectDuplicate(conversationData2);

    expect(duplicateResult.isDuplicate).toBe(true);
    expect(duplicateResult.requiresConfirmation).toBe(true);

    const rejectMessage = await conversationService.sendMessage(
      sessionId2,
      'no, create new registration'
    );

    expect(rejectMessage.toLowerCase()).toMatch(/new|create|separate/);

    const allRegistrations = await registrationRepository.getAllRegistrations();
    expect(allRegistrations.length).toBeGreaterThanOrEqual(2);
  }, 120000);
});
