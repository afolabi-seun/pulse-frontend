import { DEFAULT_ORGANIZATION_NAME, DEFAULT_ORGANIZATION_SLUG, useCurrentOrganization } from '../../api/organization';

/**
 * The signed-in user's organization, shown under the product name. Renders nothing while loading, on
 * error, or while the default organization still has its seeded placeholder name ("Default organization") —
 * so a single-organization deployment looks exactly as it did before multi-tenancy until its head names it.
 */
export default function OrganizationName({ className }: { className?: string }) {
  const { data: organization } = useCurrentOrganization();

  // The default organization's seeded name is a placeholder; once its head renames it, it shows like any other.
  const isPlaceholder = organization?.slug === DEFAULT_ORGANIZATION_SLUG && organization.name === DEFAULT_ORGANIZATION_NAME;
  if (!organization || isPlaceholder) return null;

  return (
    <span className={className} title={organization.name} data-testid="organization-name">
      {organization.name}
    </span>
  );
}
