import { RegistrationRepository } from '../database/repositories/registrationRepository.js';
import { DuplicateDetectionResult, ConversationData } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { EmbeddingService } from './embeddingService.js';

export class DuplicateDetectionService {
  private registrationRepository: RegistrationRepository;
  private embeddingService: EmbeddingService;
  private similarityThreshold = 0.85; // 85% similarity threshold

  constructor() {
    this.registrationRepository = new RegistrationRepository();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Detect duplicates using AI embeddings for semantic similarity
   */
  async detectDuplicate(
    conversationData: ConversationData
  ): Promise<DuplicateDetectionResult> {
    try {
      // Generate embedding for the new registration data
      const newEmbedding = await this.embeddingService.generateEmbedding(conversationData);

      // Get all existing registrations with embeddings
      const existingRegistrations = await this.registrationRepository.getAllRegistrationsWithEmbeddings();

      if (existingRegistrations.length === 0) {
        return {
          isDuplicate: false,
          requiresConfirmation: false,
        };
      }

      // Prepare candidate embeddings for comparison
      const candidateEmbeddings = existingRegistrations
        .filter((reg) => reg.embedding?.vector)
        .map((reg) => ({
          id: reg.id,
          vector: reg.embedding!.vector,
          data: reg.conversationData,
        }));

      // Find similar registrations based on embedding similarity
      const similarRegistrations = this.embeddingService.findSimilarEmbeddings(
        newEmbedding.vector,
        candidateEmbeddings.map((c) => ({ id: c.id, vector: c.vector })),
        this.similarityThreshold
      );

      if (similarRegistrations.length === 0) {
        // Also check for exact license plate matches as a safety net
        const licensePlate = conversationData.licensePlate || conversationData.license_plate;
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
      }

      // Get the most similar registration
      const mostSimilar = similarRegistrations[0];
      const existingData = candidateEmbeddings.find((c) => c.id === mostSimilar.id)?.data;

      // Generate explanation for the similarity
      let explanation = '';
      if (existingData) {
        explanation = await this.embeddingService.generateSimilarityExplanation(
          conversationData,
          existingData,
          mostSimilar.similarity
        );
      }

      logger.info('AI-based duplicate detected', {
        existingId: mostSimilar.id,
        similarity: mostSimilar.similarity,
        explanation,
      });

      return {
        isDuplicate: true,
        similarityScore: mostSimilar.similarity,
        existingRegistrationId: mostSimilar.id,
        requiresConfirmation: true,
      };
    } catch (error) {
      logger.error('Error detecting duplicates with AI', { error });
      throw new Error('Failed to detect duplicates');
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
