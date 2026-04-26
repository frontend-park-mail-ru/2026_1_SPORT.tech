// src/types/validation.types.ts

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  apiFormat?: {
    error: {
      code: string;
      message: string;
      fields: ValidationError[];
    };
  } | null;
}

export interface DonationValidationResult extends ValidationResult {
  amountNumber: number | null;
}

export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  messages?: Record<string, string>;
}
