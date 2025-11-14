import { RegistrationRepository } from '../database/repositories/registrationRepository.js';
import { DuplicateDetectionResult, ConversationData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { EmbeddingService } from './embeddingService.js';

export class DuplicateDetectionService {
  private registrationRepository: RegistrationRepository;
  private embeddingService: EmbeddingService;
  private similarityThreshold = parseFloat(process.env.TEST_SIMILARITY_THRESHOLD || '0.85'); // 85% similarity threshold

  constructor() {
    this.registrationRepository = new RegistrationRepository();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Detect duplicates using AI embeddings for semantic similarity
   */
  async detectDuplicate(conversationData: ConversationData): Promise<DuplicateDetectionResult> {
    try {
      logger.info('Starting duplicate detection', {
        dataKeys: Object.keys(conversationData),
      });

      let newEmbedding;
      try {
        // Try to generate embedding for the new registration data
        newEmbedding = await this.embeddingService.generateEmbedding(conversationData);
        logger.info('Generated embedding for duplicate detection', {
          vectorLength: newEmbedding.vector.length,
        });
      } catch (embeddingError) {
        logger.warn(
          'Failed to generate embedding for duplicate detection, falling back to license plate check',
          {
            error: embeddingError instanceof Error ? embeddingError.message : embeddingError,
          }
        );
        // If embedding fails, fall back to license plate check only
        return this.checkLicensePlateOnly(conversationData);
      }

      // Get all existing registrations with embeddings
      const existingRegistrations =
        await this.registrationRepository.getAllRegistrationsWithEmbeddings();

      logger.info('Retrieved existing registrations for comparison', {
        total: existingRegistrations.length,
        withEmbeddings: existingRegistrations.filter((r) => r.embedding?.vector).length,
      });

      if (existingRegistrations.length === 0) {
        return {
          isDuplicate: false,
          requiresConfirmation: false,
        };
      }

      // Prepare candidate embeddings for comparison
      const candidateEmbeddings = existingRegistrations
        .filter((reg) => reg.embedding?.vector && reg.embedding.vector.length > 0)
        .map((reg) => ({
          id: reg.id,
          vector: reg.embedding!.vector,
          data: reg.conversationData,
        }));

      logger.info('Prepared candidates for similarity comparison', {
        candidateCount: candidateEmbeddings.length,
      });

      if (candidateEmbeddings.length > 0) {
        // Find similar registrations based on embedding similarity
        const similarRegistrations = this.embeddingService.findSimilarEmbeddings(
          newEmbedding.vector,
          candidateEmbeddings.map((c) => ({ id: c.id, vector: c.vector })),
          this.similarityThreshold
        );

        logger.info('Similarity search results', {
          foundSimilar: similarRegistrations.length > 0,
          similarCount: similarRegistrations.length,
          topSimilarity: similarRegistrations[0]?.similarity,
        });

        if (similarRegistrations.length > 0) {
          // Get the most similar registration
          const mostSimilar = similarRegistrations[0];

          logger.info('AI-based duplicate detected', {
            existingId: mostSimilar.id,
            similarity: mostSimilar.similarity,
          });

          return {
            isDuplicate: true,
            similarityScore: mostSimilar.similarity,
            existingRegistrationId: mostSimilar.id,
            requiresConfirmation: true,
          };
        }
      }

      // If no embedding-based duplicates found, check for exact license plate matches
      return this.checkLicensePlateOnly(conversationData);
    } catch (error) {
      logger.error('Error detecting duplicates with AI', { error });
      // Fall back to license plate check on error
      return this.checkLicensePlateOnly(conversationData);
    }
  }

  /**
   * Fallback method to check duplicates by license plate only
   */
  private async checkLicensePlateOnly(
    conversationData: ConversationData
  ): Promise<DuplicateDetectionResult> {
    try {
      // Extract license plate from nested or flat structure
      const car = conversationData.car as any;
      const licensePlate =
        car?.license_plate ||
        conversationData.license_plate ||
        (conversationData as any).licensePlate;

      if (licensePlate) {
        const exactMatches = await this.registrationRepository.findByLicensePlate(
          String(licensePlate)
        );

        if (exactMatches.length > 0) {
          logger.info('Exact license plate match found', {
            existingId: exactMatches[0].id,
          });

          return {
            isDuplicate: true,
            similarityScore: 1.0,
            existingRegistrationId: exactMatches[0].id,
            requiresConfirmation: true,
          };
        }
      }

      return {
        isDuplicate: false,
        requiresConfirmation: false,
      };
    } catch (error) {
      logger.error('Error checking license plate duplicates', { error });
      // If even license plate check fails, return no duplicate
      return {
        isDuplicate: false,
        requiresConfirmation: false,
      };
    }
  }

  /**
   * Generate confirmation message without exposing PII
   */
  generateConfirmationMessage(): string {
    return (
      'A similar registration was found in our system. ' +
      'Would you like to update the existing information? ' +
      'Please confirm by saying "yes" or "confirm".'
    );
  }
}
