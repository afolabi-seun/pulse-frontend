import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AudioWaveform, Check, ImageUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_ORGANIZATION_NAME,
  useCurrentOrganization,
  useOrganizationLogo,
  useRemoveLogo,
  useUpdateBranding,
  useUploadLogo,
} from '../../api/organization';
import PageHeader from '../../components/layout/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Button from '../../components/ui/Button';
import { applyBrandColor, isHexColor } from '../../lib/brandColor';
import { ApiError } from '../../lib/errors';
import { cn } from '@/lib/utils';

/** Pulse's own violet, shown when an organization hasn't chosen a colour. */
const PULSE_COLOR = '#8B5CF6';

const SWATCHES = [
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Teal', hex: '#0D9488' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Pink', hex: '#DB2777' },
  { name: 'Slate', hex: '#475569' },
];

/** The API's limits (OrganizationLogo) — checked here too so a bad file is refused before it's uploaded. */
const LOGO_MAX_BYTES = 256 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function message(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export default function BrandingPage() {
  const { data: organization, error, refetch } = useCurrentOrganization();
  const logoUrl = useOrganizationLogo();
  const update = useUpdateBranding();
  const upload = useUploadLogo();
  const removeLogo = useRemoveLogo();

  const [name, setName] = useState('');
  /** What's typed in the hex field; empty means "use Pulse's colour". */
  const [color, setColor] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setColor(organization.brandColor ?? '');
  }, [organization]);

  const colorValid = color === '' || isHexColor(color);
  // The preview takes the colour being edited without touching the rest of the app until it's saved.
  useEffect(() => {
    if (preview.current) applyBrandColor(color, preview.current);
  }, [color, organization]);

  if (error) return <ErrorState onRetry={() => void refetch()} />;

  const trimmedName = name.trim();
  const dirty = !!organization && (trimmedName !== organization.name || (color || null) !== organization.brandColor);
  const canSave = dirty && colorValid && trimmedName.length > 0 && !update.isPending;

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    update.mutate(
      { name: trimmedName, brandColor: color === '' ? null : color.toUpperCase() },
      {
        onSuccess: () => toast.success('Branding saved.'),
        onError: (err) => toast.error(message(err, 'Could not save the branding.')),
      },
    );
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still fires a change
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return void toast.error('The logo must be a PNG, JPEG or WebP image.');
    if (file.size > LOGO_MAX_BYTES) return void toast.error('The logo must be 256 KB or smaller.');
    upload.mutate(file, {
      onSuccess: () => toast.success('Logo updated.'),
      onError: (err) => toast.error(message(err, 'Could not upload the logo.')),
    });
  }

  function handleRemoveLogo() {
    removeLogo.mutate(undefined, {
      onSuccess: () => toast.success('Logo removed.'),
      onError: (err) => toast.error(message(err, 'Could not remove the logo.')),
    });
  }

  const previewName = trimmedName && trimmedName !== DEFAULT_ORGANIZATION_NAME ? trimmedName : 'Your organization';

  return (
    <div>
      <PageHeader title="Branding" description="Your organization's name, accent colour and logo, as everyone in it sees them." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization name</Label>
                <Input id="org-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} disabled={!organization} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-color">Accent colour</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Colour presets">
                  {SWATCHES.map((s) => {
                    const selected = color.toUpperCase() === s.hex;
                    return (
                      <button
                        key={s.hex}
                        type="button"
                        aria-label={s.name}
                        aria-pressed={selected}
                        onClick={() => setColor(s.hex)}
                        style={{ backgroundColor: s.hex }}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selected && 'ring-2 ring-foreground',
                        )}
                      >
                        {selected && <Check className="h-4 w-4 text-white" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick a custom colour"
                    value={isHexColor(color) ? color : PULSE_COLOR}
                    onChange={(e) => setColor(e.target.value.toUpperCase())}
                    className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                  />
                  <Input
                    id="org-color"
                    value={color}
                    placeholder="#RRGGBB"
                    maxLength={7}
                    onChange={(e) => setColor(e.target.value.trim())}
                    aria-invalid={!colorValid}
                    aria-describedby={colorValid ? undefined : 'org-color-error'}
                    className="w-32 font-mono"
                  />
                  {color !== '' && (
                    <Button type="button" variant="ghost" onClick={() => setColor('')}>
                      Use Pulse's colour
                    </Button>
                  )}
                </div>
                {!colorValid && (
                  <p id="org-color-error" className="text-xs text-destructive">
                    Enter a colour as # and six hex digits, like #2563EB.
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={!canSave}>
                  {update.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {logoUrl ? (
                  <img src={logoUrl} alt="Current logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageUp className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Logo</p>
                <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 256 KB. Square images work best.</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={LOGO_TYPES.join(',')}
                onChange={handleFile}
                className="hidden"
                aria-label="Logo file"
              />
              <Button type="button" variant="secondary" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                {upload.isPending ? 'Uploading…' : organization?.logoVersion ? 'Replace logo' : 'Upload logo'}
              </Button>
              {organization?.logoVersion && (
                <Button type="button" variant="ghost" disabled={removeLogo.isPending} onClick={handleRemoveLogo}>
                  Remove
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <Card className="overflow-hidden">
            <div ref={preview} data-testid="branding-preview">
              <div className="flex items-center gap-2.5 border-b border-border bg-sidebar px-4 py-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-md">
                    <AudioWaveform className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground">Pulse</p>
                  <p className="truncate text-xs text-sidebar-muted-foreground">{previewName}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Primary button</span>
                  <span className="text-xs font-medium text-primary">A link</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-2/3 rounded-full bg-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Buttons, links and highlights across Pulse take this colour.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
