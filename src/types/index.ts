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

// Type for conversation data collected from users
export type ConversationDataValue = string | number | boolean | null | undefined;
export type ConversationData = Record<string, ConversationDataValue>;

// Type for metadata
export type MetadataValue = string | number | boolean | null | undefined | ConversationDataValue[];
export type Metadata = Record<string, MetadataValue>;

export interface Registration {
  id: string;
  sessionId: string;
  promptVersion: string;
  conversationData: ConversationData;
  metadata?: Metadata;
  createdAt: string;
  updatedAt: string;
}

// ChatStartRequest has no properties, but we use a type alias to avoid empty interface warning
export type ChatStartRequest = object

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
