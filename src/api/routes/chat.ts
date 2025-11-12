import { H3Event, readBody } from 'h3';
import { nanoid } from 'nanoid';
import { ConversationService } from '../../services/conversationService.js';
import { DuplicateDetectionService } from '../../services/duplicateDetectionService.js';
import { RegistrationRepository } from '../../database/repositories/registrationRepository.js';
import { SessionRepository } from '../../database/repositories/sessionRepository.js';
import {
  ChatMessageRequest,
  ChatCompleteRequest,
  ChatStartResponse,
  ChatMessageResponse,
  ChatCompleteResponse,
  SessionResponse,
} from '../../types/index.js';
import { logger } from '../../utils/logger.js';

const conversationService = new ConversationService();
const duplicateDetectionService = new DuplicateDetectionService();
const registrationRepository = new RegistrationRepository();
const sessionRepository = new SessionRepository();

export async function handleChatStart(_event: H3Event): Promise<ChatStartResponse> {
  try {
    const sessionId = nanoid();

    // Initialize conversation service if not already done
    if (!conversationService.getPromptVersion()) {
      await conversationService.initialize();
    }

    const initialMessage = await conversationService.startConversation(sessionId);

    logger.info('Chat started', { sessionId });

    return {
      sessionId,
      message: initialMessage,
    };
  } catch (error) {
    logger.error('Error starting chat', { error });
    throw new Error('Failed to start chat session');
  }
}

export async function handleChatMessage(event: H3Event): Promise<ChatMessageResponse> {
  try {
    const body = await readBody<ChatMessageRequest>(event);

    if (!body.sessionId || !body.message) {
      throw new Error('sessionId and message are required');
    }

    const response = await conversationService.sendMessage(body.sessionId, body.message);

    logger.info('Message sent', { sessionId: body.sessionId });

    return {
      sessionId: body.sessionId,
      message: response,
    };
  } catch (error) {
    logger.error('Error sending message', { error });
    throw new Error('Failed to send message');
  }
}

export async function handleChatComplete(event: H3Event): Promise<ChatCompleteResponse> {
  try {
    const body = await readBody<ChatCompleteRequest>(event);

    if (!body.sessionId) {
      throw new Error('sessionId is required');
    }

    // Extract conversation data
    const conversationData = await conversationService.extractConversationData(body.sessionId);

    if (Object.keys(conversationData).length === 0) {
      throw new Error('No data could be extracted from conversation');
    }

    // Detect duplicates
    const duplicateResult = await duplicateDetectionService.detectDuplicate(conversationData);

    if (duplicateResult.isDuplicate && duplicateResult.requiresConfirmation) {
      logger.info('Duplicate detected, confirmation required', { sessionId: body.sessionId });

      return {
        success: false,
        message: duplicateDetectionService.generateConfirmationMessage(),
        duplicateDetected: true,
        duplicateConfirmationRequired: true,
      };
    }

    // Create registration
    const registration = await registrationRepository.createRegistration(
      body.sessionId,
      conversationService.getPromptVersion(),
      conversationData,
      {
        completedAt: new Date().toISOString(),
      }
    );

    // Mark session as complete
    await sessionRepository.completeSession(body.sessionId);

    logger.info('Registration created successfully', {
      sessionId: body.sessionId,
      registrationId: registration.id,
    });

    return {
      success: true,
      message: 'Registration completed successfully. Thank you!',
      registrationId: registration.id,
      duplicateDetected: false,
    };
  } catch (error) {
    logger.error('Error completing chat', { error });
    throw new Error('Failed to complete chat session');
  }
}

export async function handleGetSession(event: H3Event): Promise<SessionResponse> {
  try {
    const sessionId = event.context.params?.id;

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const session = await conversationService.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    return { session };
  } catch (error) {
    logger.error('Error getting session', { error });
    throw new Error('Failed to get session');
  }
}

export async function handleGetRegistrations(_event: H3Event) {
  try {
    const registrations = await registrationRepository.getAllRegistrations();
    return { registrations };
  } catch (error) {
    logger.error('Error getting registrations', { error });
    throw new Error('Failed to get registrations');
  }
}
