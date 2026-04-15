/**
 * Global error handling utilities
 * Centralized error handling, validation, and toast notifications
 */

import { toast } from "sonner";
import type { Locale } from "./i18n";

/**
 * Error handler for async operations with optional toast notification
 * @param error Error object or string
 * @param fallbackMessage Default message if error has no message
 * @param showToast Whether to show error toast (default: true)
 * @returns Error message string
 */
export function handleError(
  error: unknown,
  fallbackMessage: string = "An unexpected error occurred",
  showToast: boolean = true
): string {
  let message = fallbackMessage;

  if (error instanceof Error) {
    message = error.message || fallbackMessage;
  } else if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") {
      message = err.message;
    }
  }

  if (showToast) {
    toast.error(message);
  }

  return message;
}

/**
 * Async operation wrapper with automatic error handling
 * @param operation Async function to execute
 * @param errorMessage Message to show on error
 * @returns Promise with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string = "Operation failed"
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, errorMessage, true);
    return null;
  }
}

/**
 * Async operation wrapper with optional error handling
 * Silently fails if showError is false
 */
export async function withOptionalErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string = "Operation failed",
  showError: boolean = true
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (showError) {
      handleError(error, errorMessage, true);
    }
    return null;
  }
}

/**
 * Validation error helper
 * Shows validation error as toast
 */
export function showValidationError(message: string): void {
  toast.error(message);
}

/**
 * Success notification helper
 */
export function showSuccess(message: string, options?: any): void {
  toast.success(message, options);
}

/**
 * Info notification helper
 */
export function showInfo(message: string, options?: any): void {
  toast.message(message, options);
}

/**
 * Loading notification helper
 * Returns a function to dismiss the notification
 */
export function showLoading(message: string, options?: any): () => void {
  const toastId = toast.loading(message, options);
  return () => toast.dismiss(toastId);
}

/**
 * API error extractor
 * Safely extracts error messages from various API response formats
 */
export function extractApiErrorMessage(error: unknown, defaultMessage: string = "API request failed"): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    // Supabase error format
    if (typeof err.message === "string") {
      return err.message;
    }

    // JSON:API error format
    if (Array.isArray(err.errors) && err.errors.length > 0) {
      const firstError = err.errors[0] as Record<string, unknown>;
      if (typeof firstError.detail === "string") {
        return firstError.detail;
      }
      if (typeof firstError.title === "string") {
        return firstError.title;
      }
    }

    // Generic error with detail
    if (typeof err.detail === "string") {
      return err.detail;
    }
  }

  return defaultMessage;
}

/**
 * Network error checker
 * Returns true if error is related to network issues
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("offline") ||
      message.includes("timeout") ||
      message.includes("failed to fetch")
    );
  }
  return false;
}

/**
 * Validation utilities
 */
export const validate = {
  /**
   * Check if string is not empty
   */
  notEmpty(value: string, message: string): boolean {
    if (!value.trim()) {
      showValidationError(message);
      return false;
    }
    return true;
  },

  /**
   * Check if value exists
   */
  required<T>(value: T | null | undefined, message: string): boolean {
    if (!value) {
      showValidationError(message);
      return false;
    }
    return true;
  },

  /**
   * Check if array is not empty
   */
  notEmptyArray<T>(value: T[], message: string): boolean {
    if (!Array.isArray(value) || value.length === 0) {
      showValidationError(message);
      return false;
    }
    return true;
  },
};
