import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Client errors will not resolve on retry
        if (error instanceof ApiError && error.status && error.status < 500) return false;
        return failureCount < 2;
      },
      // Queries show an inline error state — they do not toast
    },
    mutations: {
      onError: (error) => {
        if (!(error instanceof ApiError)) {
          toast.error('Something went wrong.');
          return;
        }

        // Validation errors are shown inline via applyServerErrors — do not toast
        if (error.isValidation()) return;

        // Auth errors: UNAUTHORIZED is handled inline on the login form;
        // ACCOUNT_LOCKED is also shown inline there. The interceptor handles
        // session-expired 401s by redirecting — they never reach this handler.
        if (error.code === 'UNAUTHORIZED' || error.code === 'ACCOUNT_LOCKED') return;

        if (error.isForbidden()) { toast.error("You don't have permission to do that."); return; }
        if (error.isServer())   { toast.error('Server error — try again in a moment.');  return; }
        if (error.isNotFound()) { toast.error('The item no longer exists.');              return; }

        // CONFLICT and other named errors — toast the message.
        // BUSINESS_RULE_VIOLATION (422) is shown inline by applyServerErrors; skip the toast
        // so forms don't double-report. Non-form paths (bulk ops) should add their own onError.
        if (error.code === 'BUSINESS_RULE_VIOLATION') return;

        toast.error(error.message);
      },
    },
  },
});
