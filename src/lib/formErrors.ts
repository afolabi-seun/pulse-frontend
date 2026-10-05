import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import { ApiError } from './errors';

/**
 * Maps server errors back onto the form.
 * - 400 validation: maps field errors inline next to the relevant input.
 * - 422 business rule violations: maps the message to `errors.root` so the
 *   form can render it below the submit button.
 * Call this in a mutation's onError.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): void {
  if (!(error instanceof ApiError)) return;

  if (error.isValidation()) {
    for (const [field, messages] of Object.entries(error.fieldErrors ?? {})) {
      setError(field as Path<T>, { type: 'server', message: messages[0] });
    }
    return;
  }

  if (error.status === 422) {
    setError('root' as Path<T>, { type: 'server', message: error.message });
  }
}
