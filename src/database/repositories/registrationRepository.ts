import { getDatabase } from '../db.js';
import { Registration, ConversationData, Metadata, EmbeddingData } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { ObjectId } from 'mongodb';
import { EmbeddingService } from '../../services/embeddingService.js';

export class RegistrationRepository {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  private getCollection() {
    return getDatabase().collection<RegistrationDocument>('registrations');
  }

  async createRegistration(
    sessionId: string,
    promptVersion: string,
    conversationData: ConversationData,
    metadata?: Metadata
  ): Promise<Registration> {
    try {
      // Generate embedding for the registration data
      const embedding = await this.embeddingService.generateEmbedding(conversationData);

      const now = new Date();
      const doc: RegistrationDocument = {
        sessionId,
        promptVersion,
        conversationData,
        metadata,
        embedding,
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
    conversationData: ConversationData,
    _threshold: number = 0.3
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
      const conditions: Array<Record<string, unknown>> = [];

      // Check for specific fields that might indicate duplicates
      if (conversationData.name && typeof conversationData.name === 'string') {
        conditions.push({
          'conversationData.name': { $regex: new RegExp(conversationData.name, 'i') },
        });
      }

      if (conversationData.licenseplate || conversationData.license_plate) {
        const licensePlate = conversationData.licenseplate || conversationData.license_plate;
        if (typeof licensePlate === 'string') {
          conditions.push({
            $or: [
              { 'conversationData.licenseplate': { $regex: new RegExp(licensePlate, 'i') } },
              { 'conversationData.license_plate': { $regex: new RegExp(licensePlate, 'i') } },
            ],
          });
        }
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

  async getAllRegistrationsWithEmbeddings(): Promise<Registration[]> {
    try {
      const docs = await this.getCollection()
        .find({ 'embedding.vector': { $exists: true } })
        .sort({ createdAt: -1 })
        .toArray();
      return docs.map((doc) => this.mapToRegistration(doc));
    } catch (error) {
      logger.error('Error getting registrations with embeddings', { error });
      throw new Error('Failed to get registrations with embeddings');
    }
  }

  async findByLicensePlate(licensePlate: string): Promise<Registration[]> {
    try {
      const normalizedPlate = licensePlate.toUpperCase().replace(/\s+/g, '');

      const docs = await this.getCollection()
        .find({
          $or: [
            { 'conversationData.licensePlate': { $regex: new RegExp(`^${normalizedPlate}$`, 'i') } },
            { 'conversationData.license_plate': { $regex: new RegExp(`^${normalizedPlate}$`, 'i') } },
          ],
        })
        .toArray();

      return docs.map((doc) => this.mapToRegistration(doc));
    } catch (error) {
      logger.error('Error finding registration by license plate', { error, licensePlate });
      throw new Error('Failed to find registration by license plate');
    }
  }

  async updateRegistration(
    id: string,
    conversationData: ConversationData,
    metadata?: Metadata
  ): Promise<Registration> {
    try {
      // Generate new embedding for updated data
      const embedding = await this.embeddingService.generateEmbedding(conversationData);

      const result = await this.getCollection().findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            conversationData,
            metadata,
            embedding,
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
      embedding: doc.embedding,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}

interface RegistrationDocument {
  _id?: ObjectId;
  sessionId: string;
  promptVersion: string;
  conversationData: ConversationData;
  metadata?: Metadata;
  embedding?: EmbeddingData;
  createdAt: Date;
  updatedAt: Date;
}
