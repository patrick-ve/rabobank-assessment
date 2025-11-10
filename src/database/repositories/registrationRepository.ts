import { getDatabase } from '../db.js';
import { Registration } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { ObjectId } from 'mongodb';

export class RegistrationRepository {
  private getCollection() {
    return getDatabase().collection<RegistrationDocument>('registrations');
  }

  async createRegistration(
    sessionId: string,
    promptVersion: string,
    conversationData: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Registration> {
    try {
      const now = new Date();
      const doc: RegistrationDocument = {
        sessionId,
        promptVersion,
        conversationData,
        metadata,
        createdAt: now,
        updatedAt: now,
      };

      const result = await this.getCollection().insertOne(doc);
      return this.mapToRegistration({ ...doc, _id: result.insertedId });
    } catch (error) {
      logger.error('Error creating registration', { error, sessionId });
      throw new Error('Failed to create registration');
    }
  }

  async getAllRegistrations(): Promise<Registration[]> {
    try {
      const docs = await this.getCollection().find().sort({ createdAt: -1 }).toArray();
      return docs.map((doc) => this.mapToRegistration(doc));
    } catch (error) {
      logger.error('Error getting all registrations', { error });
      throw new Error('Failed to get registrations');
    }
  }

  async findSimilarRegistrations(
    conversationData: Record<string, any>,
    threshold: number = 0.3
  ): Promise<Registration[]> {
    try {
      // Use MongoDB's text search for finding similar documents
      // Build a search string from the conversation data
      const searchTerms = Object.values(conversationData)
        .filter((v) => typeof v === 'string')
        .join(' ');

      if (!searchTerms) {
        return [];
      }

      // Text search
      const textSearchResults = await this.getCollection()
        .find({
          $text: { $search: searchTerms },
        })
        .limit(5)
        .toArray();

      if (textSearchResults.length > 0) {
        return textSearchResults.map((doc) => this.mapToRegistration(doc));
      }

      // Fallback: field-by-field comparison
      const conditions: any[] = [];

      // Check for specific fields that might indicate duplicates
      if (conversationData.name) {
        conditions.push({
          'conversationData.name': { $regex: new RegExp(conversationData.name, 'i') },
        });
      }

      if (conversationData.licenseplate || conversationData.license_plate) {
        const licensePlate = conversationData.licenseplate || conversationData.license_plate;
        conditions.push({
          $or: [
            { 'conversationData.licenseplate': { $regex: new RegExp(licensePlate, 'i') } },
            { 'conversationData.license_plate': { $regex: new RegExp(licensePlate, 'i') } },
          ],
        });
      }

      if (conversationData.birthdate) {
        conditions.push({ 'conversationData.birthdate': conversationData.birthdate });
      }

      if (conditions.length === 0) {
        return [];
      }

      const docs = await this.getCollection()
        .find({
          $or: conditions,
        })
        .limit(5)
        .toArray();

      return docs.map((doc) => this.mapToRegistration(doc));
    } catch (error) {
      logger.error('Error finding similar registrations', { error });
      throw new Error('Failed to find similar registrations');
    }
  }

  async updateRegistration(
    id: string,
    conversationData: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<Registration> {
    try {
      const result = await this.getCollection().findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            conversationData,
            metadata,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error('Registration not found');
      }

      return this.mapToRegistration(result);
    } catch (error) {
      logger.error('Error updating registration', { error, id });
      throw new Error('Failed to update registration');
    }
  }

  private mapToRegistration(doc: RegistrationDocument): Registration {
    return {
      id: doc._id!.toString(),
      sessionId: doc.sessionId,
      promptVersion: doc.promptVersion,
      conversationData: doc.conversationData,
      metadata: doc.metadata,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}

interface RegistrationDocument {
  _id?: ObjectId;
  sessionId: string;
  promptVersion: string;
  conversationData: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
