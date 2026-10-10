import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { applyBrandColor } from '../lib/brandColor';
import type { CurrentOrganizationDto } from '../types/api';

export const organizationKeys = {
  current: () => ['organization', 'current'] as const,
  logo: (version: string | null) => ['organization', 'logo', version] as const,
};

/** Slug of the organization every pre-multi-tenancy account belongs to. */
export const DEFAULT_ORGANIZATION_SLUG = 'default';
/** That organization's seeded name — a placeholder until its head renames it. */
export const DEFAULT_ORGANIZATION_NAME = 'Default organization';

/** The name to show for an organization — null while the default organization still has its seeded placeholder name. */
export function organizationDisplayName(organization: CurrentOrganizationDto | undefined): string | null {
  if (!organization) return null;
  const isPlaceholder = organization.slug === DEFAULT_ORGANIZATION_SLUG && organization.name === DEFAULT_ORGANIZATION_NAME;
  return isPlaceholder ? null : organization.name;
}

/** The signed-in user's organization. It changes only when its head rebrands it, so it's cached for the session. */
export function useCurrentOrganization(enabled = true) {
  return useQuery({
    queryKey: organizationKeys.current(),
    queryFn: () => client.get<CurrentOrganizationDto>('/organization').then((r) => r.data!),
    enabled,
    staleTime: Infinity,
  });
}

/** The organization's logo as an object URL, refetched only when its version changes. Undefined without a logo. */
export function useOrganizationLogo() {
  const { data: organization } = useCurrentOrganization();
  const version = organization?.logoVersion ?? null;
  const query = useQuery({
    queryKey: organizationKeys.logo(version),
    queryFn: () =>
      client.get<Blob>('/organization/logo', { responseType: 'blob' }).then((r) => URL.createObjectURL(r.data as Blob)),
    enabled: !!version,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return version ? query.data : undefined;
}

/** Applies the organization's accent colour to the whole app for as long as the caller is mounted. */
export function useApplyOrganizationBrand() {
  const { data: organization } = useCurrentOrganization();
  const color = organization?.brandColor ?? null;
  useEffect(() => {
    applyBrandColor(color);
    return () => applyBrandColor(null);
  }, [color]);
}

function useOrganizationMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<CurrentOrganizationDto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (organization) => qc.setQueryData(organizationKeys.current(), organization),
  });
}

export function useUpdateBranding() {
  return useOrganizationMutation((branding: { name: string; brandColor: string | null }) =>
    client.put<CurrentOrganizationDto>('/organization/branding', branding).then((r) => r.data!));
}

export function useUploadLogo() {
  return useOrganizationMutation((file: File) => {
    const form = new FormData();
    form.append('file', file);
    // The client defaults to JSON, which would make axios serialise the form; say multipart so it sends the file.
    return client
      .put<CurrentOrganizationDto>('/organization/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data!);
  });
}

export function useRemoveLogo() {
  return useOrganizationMutation(() => client.delete<CurrentOrganizationDto>('/organization/logo').then((r) => r.data!));
}
