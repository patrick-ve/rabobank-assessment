import { embedMany, embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from '../utils/logger.js';
import { EmbeddingData } from '../types/index.js';

export class EmbeddingService {
  private openai: ReturnType<typeof createOpenAI>;
  private embeddingModel = process.env.TEST_EMBEDDING_MODEL || 'text-embedding-3-small';

  constructor() {
    this.openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  /**
   * Generate embedding for registration data
   */
  async generateEmbedding(data: Record<string, any>): Promise<EmbeddingData> {
    try {
      // Create a normalized string representation of the data
      const text = this.normalizeDataForEmbedding(data);

      logger.info('Generating embedding for text', {
        text,
        dataKeys: Object.keys(data),
        hasApiKey: !!process.env.OPENAI_API_KEY
      });

      // Generate embedding using OpenAI
      const { embedding } = await embed({
        model: this.openai.embedding(this.embeddingModel),
        value: text,
      });

      logger.info('Successfully generated embedding', {
        vectorLength: embedding.length,
        model: this.embeddingModel
      });

      return {
        vector: embedding,
        model: this.embeddingModel,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error generating embedding - detailed', {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error,
        data: JSON.stringify(data),
        apiKeyLength: process.env.OPENAI_API_KEY?.length || 0
      });
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple registrations
   */
  async generateEmbeddings(dataArray: Array<Record<string, any>>): Promise<EmbeddingData[]> {
    try {
      // Create normalized string representations
      const texts = dataArray.map((data) => this.normalizeDataForEmbedding(data));

      // Generate embeddings in batch
      const { embeddings } = await embedMany({
        model: this.openai.embedding(this.embeddingModel),
        values: texts,
      });

      return embeddings.map((embedding) => ({
        vector: embedding,
        model: this.embeddingModel,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('Error generating embeddings', { error });
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Find similar registrations based on embedding similarity
   */
  findSimilarEmbeddings(
    targetEmbedding: number[],
    candidateEmbeddings: Array<{ id: string; vector: number[] }>,
    threshold: number = 0.85
  ): Array<{ id: string; similarity: number }> {
    const results: Array<{ id: string; similarity: number }> = [];

    for (const candidate of candidateEmbeddings) {
      const similarity = this.calculateCosineSimilarity(targetEmbedding, candidate.vector);

      if (similarity >= threshold) {
        results.push({
          id: candidate.id,
          similarity,
        });
      }
    }

    // Sort by similarity (highest first)
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Normalize data for consistent embedding generation
   */
  private normalizeDataForEmbedding(data: Record<string, any>): string {
    // Create a deterministic string representation
    const normalized: string[] = [];

    // Handle nested structure from ConversationData
    // Check for car information (nested or flat)
    if (data.car) {
      if (data.car.type) normalized.push(`Car Type: ${data.car.type}`);
      if (data.car.manufacturer) normalized.push(`Manufacturer: ${data.car.manufacturer}`);
      if (data.car.model) normalized.push(`Model: ${data.car.model}`);
      if (data.car.year) normalized.push(`Year: ${data.car.year}`);
      if (data.car.license_plate) {
        const plate = String(data.car.license_plate).toUpperCase().replace(/\s+/g, '');
        normalized.push(`License Plate: ${plate}`);
      }
    }

    // Also check flat structure (for backward compatibility)
    if (data.car_type) normalized.push(`Car Type: ${data.car_type}`);
    if (data.manufacturer) normalized.push(`Manufacturer: ${data.manufacturer}`);
    if (data.model) normalized.push(`Model: ${data.model}`);
    if (data.year_of_construction) normalized.push(`Year: ${data.year_of_construction}`);
    if (data.license_plate) {
      const plate = String(data.license_plate).toUpperCase().replace(/\s+/g, '');
      normalized.push(`License Plate: ${plate}`);
    }

    // Handle customer information (nested or flat)
    if (data.customer) {
      if (data.customer.name) {
        const name = String(data.customer.name).toLowerCase().trim();
        normalized.push(`Customer: ${name}`);
      }
      if (data.customer.birthdate) normalized.push(`Birthdate: ${data.customer.birthdate}`);
    }

    // Also check flat structure
    if (data.customer_name) {
      const name = String(data.customer_name).toLowerCase().trim();
      normalized.push(`Customer: ${name}`);
    }
    if (data.birthdate) normalized.push(`Birthdate: ${data.birthdate}`);

    // Log what we're normalizing for debugging
    logger.debug('Normalized data for embedding', {
      originalKeys: Object.keys(data),
      normalizedString: normalized.join(', '),
      itemCount: normalized.length
    });

    return normalized.join(', ') || 'No data available';
  }

  /**
   * Generate explanation for why registrations are similar
   */
  async generateSimilarityExplanation(
    dataA: Record<string, any>,
    dataB: Record<string, any>,
    similarity: number
  ): Promise<string> {
    try {
      const matchedFields: string[] = [];

      // Check car fields (handle nested structure)
      const carA = dataA.car || dataA;
      const carB = dataB.car || dataB;

      if ((carA.type || dataA.car_type) === (carB.type || dataB.car_type)) {
        matchedFields.push('car type');
      }
      if (carA.manufacturer === carB.manufacturer) matchedFields.push('manufacturer');
      if (carA.model === carB.model) matchedFields.push('model');
      if ((carA.year || dataA.year_of_construction) === (carB.year || dataB.year_of_construction)) {
        matchedFields.push('year');
      }

      const plateA = String(carA.license_plate || dataA.license_plate || '').toUpperCase().replace(/\s+/g, '');
      const plateB = String(carB.license_plate || dataB.license_plate || '').toUpperCase().replace(/\s+/g, '');
      if (plateA && plateA === plateB) matchedFields.push('license plate');

      // Check customer fields (handle nested structure)
      // Note: We do NOT include PII (name, birthdate) in the explanation to comply with privacy requirements
      // These fields are still checked for similarity but not exposed in the message

      const similarityPercentage = Math.round(similarity * 100);

      if (matchedFields.length > 0) {
        return `Found ${similarityPercentage}% similarity. Matching fields: ${matchedFields.join(', ')}`;
      } else {
        return `Found ${similarityPercentage}% semantic similarity in the overall registration data`;
      }
    } catch (error) {
      logger.error('Error generating similarity explanation', { error });
      return `Found ${Math.round(similarity * 100)}% similarity`;
    }
  }
}