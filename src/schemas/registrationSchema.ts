import { z } from 'zod';
import { CAR_TYPES } from '../config/prompt.js';

// Define the car type enum based on the prompt requirements
export const CarType = z.enum(CAR_TYPES);

// Main registration schema for structured data extraction
export const RegistrationDataSchema = z.object({
  // Car information
  carType: CarType.describe('Type of car'),
  manufacturer: z.string().min(1).describe('Car manufacturer'),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .describe('Year of construction'),
  licensePlate: z
    .string()
    .min(1)
    .transform((val) => val.toUpperCase().replace(/\s+/g, ''))
    .describe('License plate number'),

  // Customer information
  customerName: z.string().min(1).describe('Customer full name'),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .describe('Customer birthdate'),
});

// Type inference from schema
export type RegistrationData = z.infer<typeof RegistrationDataSchema>;

// Schema for similarity comparison result
export const SimilarityResultSchema = z.object({
  isDuplicate: z.boolean(),
  similarityScore: z.number().min(0).max(1),
  existingRegistrationId: z.string().optional(),
  explanation: z.string().optional(),
  matchedFields: z.array(z.string()).optional(),
});

export type SimilarityResult = z.infer<typeof SimilarityResultSchema>;

// Schema for embedding storage
export const EmbeddingSchema = z.object({
  vector: z.array(z.number()),
  model: z.string(),
  createdAt: z.string().datetime(),
});

export type Embedding = z.infer<typeof EmbeddingSchema>;