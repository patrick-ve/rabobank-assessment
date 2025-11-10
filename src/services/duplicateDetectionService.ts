import { RegistrationRepository } from '../database/repositories/registrationRepository.js';
import { DuplicateDetectionResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export class DuplicateDetectionService {
  private registrationRepository: RegistrationRepository;

  constructor() {
    this.registrationRepository = new RegistrationRepository();
  }

  /**
   * Detect duplicates without exposing PII
   * Uses hashing for sensitive fields and similarity matching
   */
  async detectDuplicate(
    conversationData: Record<string, any>
  ): Promise<DuplicateDetectionResult> {
    try {
      // Find similar registrations using PostgreSQL similarity
      const similarRegistrations =
        await this.registrationRepository.findSimilarRegistrations(conversationData, 0.4);

      if (similarRegistrations.length === 0) {
        return {
          isDuplicate: false,
          requiresConfirmation: false,
        };
      }

      // Check for exact matches using hashed PII
      const hashedData = this.hashSensitiveData(conversationData);

      for (const registration of similarRegistrations) {
        const existingHashedData = this.hashSensitiveData(registration.conversationData);

        // Compare hashes to detect duplicates without exposing PII
        const matchScore = this.calculateHashMatchScore(hashedData, existingHashedData);

        if (matchScore > 0.7) {
          logger.info('Duplicate detected', {
            existingId: registration.id,
            matchScore,
          });

          return {
            isDuplicate: true,
            similarityScore: matchScore,
            existingRegistrationId: registration.id,
            requiresConfirmation: true,
          };
        }
      }

      // Similar but not exact duplicate
      if (similarRegistrations.length > 0) {
        logger.info('Similar registration found', {
          count: similarRegistrations.length,
        });
      }

      return {
        isDuplicate: false,
        requiresConfirmation: false,
      };
    } catch (error) {
      logger.error('Error detecting duplicates', { error });
      throw new Error('Failed to detect duplicates');
    }
  }

  /**
   * Hash sensitive fields to enable comparison without exposing PII
   */
  private hashSensitiveData(data: Record<string, any>): Record<string, string> {
    const sensitiveFields = ['name', 'birthdate', 'licenseplate', 'license_plate'];
    const hashed: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = key.toLowerCase().replace(/[_\s-]/g, '');

      if (sensitiveFields.some((field) => normalizedKey.includes(field))) {
        // Hash the value
        const normalizedValue = String(value).toLowerCase().trim();
        hashed[normalizedKey] = crypto
          .createHash('sha256')
          .update(normalizedValue)
          .digest('hex');
      }
    }

    return hashed;
  }

  /**
   * Calculate match score between two sets of hashed data
   */
  private calculateHashMatchScore(
    hash1: Record<string, string>,
    hash2: Record<string, string>
  ): number {
    const keys1 = Object.keys(hash1);
    const keys2 = Object.keys(hash2);

    if (keys1.length === 0 || keys2.length === 0) {
      return 0;
    }

    let matches = 0;
    let total = 0;

    // Compare common keys
    for (const key of keys1) {
      if (hash2[key]) {
        total++;
        if (hash1[key] === hash2[key]) {
          matches++;
        }
      }
    }

    return total > 0 ? matches / total : 0;
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
