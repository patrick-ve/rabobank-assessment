export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  sessionId: string;
  promptVersion: string;
  messages: Message[];
  state: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Registration {
  id: string;
  sessionId: string;
  promptVersion: string;
  conversationData: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatStartRequest {
  // No body needed for start
}

export interface ChatStartResponse {
  sessionId: string;
  message: string;
}

export interface ChatMessageRequest {
  sessionId: string;
  message: string;
}

export interface ChatMessageResponse {
  sessionId: string;
  message: string;
  isComplete?: boolean;
}

export interface ChatCompleteRequest {
  sessionId: string;
}

export interface ChatCompleteResponse {
  success: boolean;
  message: string;
  registrationId?: string;
  duplicateDetected?: boolean;
  duplicateConfirmationRequired?: boolean;
}

export interface SessionResponse {
  session: Session;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  similarityScore?: number;
  existingRegistrationId?: string;
  requiresConfirmation: boolean;
}
