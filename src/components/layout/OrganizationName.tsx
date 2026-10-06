import { DEFAULT_ORGANIZATION_SLUG, useCurrentOrganization } from '../../api/organization';

/**
 * The signed-in user's organization, shown under the product name. Renders nothing while loading, on
 * error, or for the default organization, whose seeded name ("Default organization") is a placeholder —
 * so a single-organization deployment looks exactly as it did before multi-tenancy.
 */
export default function OrganizationName({ className }: { className?: string }) {
  const { data: organization } = useCurrentOrganization();

  if (!organization || organization.slug === DEFAULT_ORGANIZATION_SLUG) return null;

  return (
    <span className={className} title={organization.name} data-testid="organization-name">
      {organization.name}
    </span>
  );
}
