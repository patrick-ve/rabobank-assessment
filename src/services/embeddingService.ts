import { embedMany, embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from '../utils/logger.js';
import { EmbeddingData } from '../types/index.js';

export class EmbeddingService {
  private openai: ReturnType<typeof createOpenAI>;
  private embeddingModel = 'text-embedding-3-small';

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

      // Generate embedding using OpenAI
      const { embedding } = await embed({
        model: this.openai.embedding(this.embeddingModel),
        value: text,
      });

      return {
        vector: embedding,
        model: this.embeddingModel,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error generating embedding', { error });
      throw new Error('Failed to generate embedding');
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

    // Add car information
    if (data.carType) normalized.push(`Car Type: ${data.carType}`);
    if (data.manufacturer) normalized.push(`Manufacturer: ${data.manufacturer}`);
    if (data.year) normalized.push(`Year: ${data.year}`);
    if (data.licensePlate) {
      // Normalize license plate (uppercase, no spaces)
      const plate = String(data.licensePlate).toUpperCase().replace(/\s+/g, '');
      normalized.push(`License Plate: ${plate}`);
    }

    // Add customer information
    if (data.customerName) {
      // Normalize name (lowercase, trimmed)
      const name = String(data.customerName).toLowerCase().trim();
      normalized.push(`Customer: ${name}`);
    }
    if (data.birthdate) normalized.push(`Birthdate: ${data.birthdate}`);

    return normalized.join(', ');
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

      // Check which fields match
      if (dataA.carType === dataB.carType) matchedFields.push('car type');
      if (dataA.manufacturer === dataB.manufacturer) matchedFields.push('manufacturer');
      if (dataA.year === dataB.year) matchedFields.push('year');

      const plateA = String(dataA.licensePlate || '').toUpperCase().replace(/\s+/g, '');
      const plateB = String(dataB.licensePlate || '').toUpperCase().replace(/\s+/g, '');
      if (plateA && plateA === plateB) matchedFields.push('license plate');

      const nameA = String(dataA.customerName || '').toLowerCase().trim();
      const nameB = String(dataB.customerName || '').toLowerCase().trim();
      if (nameA && nameA === nameB) matchedFields.push('customer name');

      if (dataA.birthdate === dataB.birthdate) matchedFields.push('birthdate');

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