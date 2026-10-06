import { useQuery } from '@tanstack/react-query';
import client from './client';
import type { CurrentOrganizationDto } from '../types/api';

export const organizationKeys = {
  current: () => ['organization', 'current'] as const,
};

/** Slug of the organization every pre-multi-tenancy account belongs to; its seeded name is a placeholder. */
export const DEFAULT_ORGANIZATION_SLUG = 'default';

/** The signed-in user's organization. It changes only when an operator renames it, so it's cached for the session. */
export function useCurrentOrganization(enabled = true) {
  return useQuery({
    queryKey: organizationKeys.current(),
    queryFn: () => client.get<CurrentOrganizationDto>('/organization').then((r) => r.data!),
    enabled,
    staleTime: Infinity,
  });
}
