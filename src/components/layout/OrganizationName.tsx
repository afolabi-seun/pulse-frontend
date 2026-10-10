import { organizationDisplayName, useCurrentOrganization } from '../../api/organization';

/**
 * The signed-in user's organization, shown under the product name. Renders nothing while loading, on
 * error, or while the default organization still has its seeded placeholder name ("Default organization") —
 * so a single-organization deployment looks exactly as it did before multi-tenancy until its head names it.
 */
export default function OrganizationName({ className }: { className?: string }) {
  const { data: organization } = useCurrentOrganization();
  const name = organizationDisplayName(organization);
  if (!name) return null;

  return (
    <span className={className} title={name} data-testid="organization-name">
      {name}
    </span>
  );
}
