export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface DonationFormData {
  amount: string;
  email: string;
}

export interface DonationValidationResult extends ValidationResult {
  amountNumber: number | null;
}
