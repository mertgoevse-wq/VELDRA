import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { withSecurity } from '~/lib/security';

const CANONICAL_REPOSITORY = 'mertgoevse-wq/VELDRA';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${CANONICAL_REPOSITORY}/releases?per_page=20`;

interface ReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

interface Release {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: ReleaseAsset[];
}

type UpdateServiceError = 'not_configured' | 'auth' | 'not_found' | 'rate_limit' | 'upstream';

function getGitHubToken(context: LoaderFunctionArgs['context']): string | undefined {
  const environment = (context as { cloudflare?: { env?: Record<string, string | undefined> } })?.cloudflare?.env;

  return (
    environment?.GITHUB_UPDATE_TOKEN ||
    environment?.GITHUB_TOKEN ||
    process.env.GITHUB_UPDATE_TOKEN ||
    process.env.GITHUB_TOKEN
  );
}

function hasInstallableAsset(release: Release): boolean {
  const assets = release.assets ?? [];

  return assets.some((asset) => {
    const name = asset.name ?? '';
    return name.endsWith('.zip') && assets.some((candidate) => candidate.name === `${name}.sha256`);
  });
}

function getReleaseVersion(release: Release): string | undefined {
  const tag = release.tag_name?.replace(/^v/, '');

  return tag && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag) ? tag : undefined;
}

async function updateManifestLoader({ context }: LoaderFunctionArgs) {
  const token = getGitHubToken(context);

  if (!token) {
    return json(
      { error: 'Update service is not configured', code: 'not_configured' as UpdateServiceError },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'VELDRA-update-checker',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (response.status === 401 || response.status === 403) {
      return json(
        { error: 'Update service authentication failed', code: 'auth' as UpdateServiceError },
        { status: 502 },
      );
    }

    if (response.status === 404) {
      return json(
        { error: 'Canonical update releases were not found', code: 'not_found' as UpdateServiceError },
        { status: 404 },
      );
    }

    if (response.status === 429) {
      return json(
        { error: 'Update service rate limit exceeded', code: 'rate_limit' as UpdateServiceError },
        { status: 429 },
      );
    }

    if (!response.ok) {
      return json(
        { error: `Update service returned ${response.status}`, code: 'upstream' as UpdateServiceError },
        { status: 502 },
      );
    }

    const releases = (await response.json()) as Release[];
    const latestInstallableRelease = releases.find(
      (release) => !release.draft && !release.prerelease && getReleaseVersion(release) && hasInstallableAsset(release),
    );
    const version = latestInstallableRelease && getReleaseVersion(latestInstallableRelease);

    if (!version) {
      return json(
        { error: 'No installable VELDRA release is available', code: 'not_found' as UpdateServiceError },
        { status: 404 },
      );
    }

    return json(
      { version },
      {
        headers: {
          'Cache-Control': 'private, max-age=300',
        },
      },
    );
  } catch (error) {
    console.error('Failed to fetch VELDRA update manifest:', error);

    return json(
      { error: 'Failed to fetch update manifest', code: 'upstream' as UpdateServiceError },
      { status: 502 },
    );
  }
}

export const loader = withSecurity(updateManifestLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});
