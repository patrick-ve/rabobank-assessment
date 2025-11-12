import { getDatabase } from '../db.js';
import { Session, Message } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { ObjectId } from 'mongodb';

export class SessionRepository {
  private getCollection() {
    return getDatabase().collection<SessionDocument>('sessions');
  }

  async createSession(sessionId: string, promptVersion: string): Promise<Session> {
    try {
      const now = new Date();
      const doc: SessionDocument = {
        sessionId,
        promptVersion,
        messages: [],
        state: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const result = await this.getCollection().insertOne(doc);
      return this.mapToSession({ ...doc, _id: result.insertedId });
    } catch (error) {
      logger.error('Error creating session', { error, sessionId });
      throw new Error('Failed to create session');
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    try {
      const doc = await this.getCollection().findOne({ sessionId });
      if (!doc) {
        return null;
      }
      return this.mapToSession(doc);
    } catch (error) {
      logger.error('Error getting session', { error, sessionId });
      throw new Error('Failed to get session');
    }
  }

  async updateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
    try {
      await this.getCollection().updateOne(
        { sessionId },
        {
          $set: {
            messages,
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      logger.error('Error updating session messages', { error, sessionId });
      throw new Error('Failed to update session messages');
    }
  }

  async completeSession(sessionId: string): Promise<void> {
    try {
      const now = new Date();
      await this.getCollection().updateOne(
        { sessionId },
        {
          $set: {
            state: 'completed',
            completedAt: now,
            updatedAt: now,
          },
        }
      );
    } catch (error) {
      logger.error('Error completing session', { error, sessionId });
      throw new Error('Failed to complete session');
    }
  }

  private mapToSession(doc: SessionDocument): Session {
    return {
      id: doc._id!.toString(),
      sessionId: doc.sessionId,
      promptVersion: doc.promptVersion,
      messages: doc.messages,
      state: doc.state,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      completedAt: doc.completedAt?.toISOString(),
    };
  }
}

interface SessionDocument {
  _id?: ObjectId;
  sessionId: string;
  promptVersion: string;
  messages: Message[];
  state: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
