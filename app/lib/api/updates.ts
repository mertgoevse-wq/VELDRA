export type UpdateErrorType = 'rate_limit' | 'network' | 'auth' | 'unknown';

export interface UpdateCheckResult {
  available: boolean;
  version: string;
  releaseNotes?: string;
  error?: {
    type: UpdateErrorType;
    message: string;
  };
}

interface PackageJson {
  version: string;
}

interface ParsedVersion {
  core: [number, number, number];
  prerelease: string[];
}

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function parseVersion(version: string): ParsedVersion | undefined {
  const match = VERSION_PATTERN.exec(version);

  if (!match) {
    return undefined;
  }

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function compareVersions(v1: string, v2: string): number {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);

  if (!version1 || !version2) {
    return 0;
  }

  for (let i = 0; i < version1.core.length; i++) {
    if (version1.core[i] !== version2.core[i]) {
      return version1.core[i] - version2.core[i];
    }
  }

  // A release without a prerelease suffix has higher precedence.
  if (version1.prerelease.length === 0 || version2.prerelease.length === 0) {
    return version1.prerelease.length === version2.prerelease.length ? 0 : version1.prerelease.length === 0 ? 1 : -1;
  }

  for (let i = 0; i < Math.max(version1.prerelease.length, version2.prerelease.length); i++) {
    const part1 = version1.prerelease[i];
    const part2 = version2.prerelease[i];

    if (part1 === undefined || part2 === undefined) {
      return part1 === undefined ? -1 : 1;
    }

    if (part1 === part2) {
      continue;
    }

    const numeric1 = /^\d+$/.test(part1);
    const numeric2 = /^\d+$/.test(part2);

    if (numeric1 && numeric2) {
      return Number(part1) - Number(part2);
    }

    if (numeric1 !== numeric2) {
      return numeric1 ? -1 : 1;
    }

    return part1 < part2 ? -1 : 1;
  }

  return 0;
}

function isValidVersion(version: string): boolean {
  return parseVersion(version) !== undefined;
}

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  try {
    const packageResponse = await fetch('/package.json');

    if (!packageResponse.ok) {
      throw new Error('Failed to fetch local package.json');
    }

    const packageData = (await packageResponse.json()) as PackageJson;

    if (!isValidVersion(packageData.version)) {
      throw new Error('Invalid package.json format: missing or invalid version');
    }

    const currentVersion = packageData.version;
    const latestPackageResponse = await fetch('/api/update-manifest', {
      headers: { Accept: 'application/json' },
    });

    if (!latestPackageResponse.ok) {
      const status = latestPackageResponse.status;
      const responseBody = (await latestPackageResponse.json().catch(() => null)) as { code?: string } | null;
      const error = new Error(`Failed to fetch latest package.json: ${status}`) as Error & {
        updateType?: UpdateErrorType;
      };
      error.updateType =
        responseBody?.code === 'auth' || responseBody?.code === 'not_configured'
          ? 'auth'
          : responseBody?.code === 'rate_limit'
            ? 'rate_limit'
            : status >= 500
              ? 'network'
              : 'unknown';
      throw error;
    }

    const latestPackageData = (await latestPackageResponse.json()) as PackageJson;

    if (!isValidVersion(latestPackageData.version)) {
      throw new Error('Invalid remote package.json format: missing or invalid version');
    }

    const latestVersion = latestPackageData.version;
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      available: hasUpdate,
      version: latestVersion,
      releaseNotes: hasUpdate ? 'Update available. Check GitHub for release notes.' : undefined,
    };
  } catch (error) {
    console.error('Error checking for updates:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const typedError = error as Error & { updateType?: UpdateErrorType };
    const isNetworkError =
      errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch');

    return {
      available: false,
      version: 'unknown',
      error: {
        type: typedError.updateType || (isNetworkError ? 'network' : 'unknown'),
        message: `Failed to check for updates: ${errorMessage}`,
      },
    };
  }
};

export const acknowledgeUpdate = async (version: string): Promise<void> => {
  try {
    localStorage.setItem('last_acknowledged_update', version);
  } catch (error) {
    console.error('Failed to store acknowledged version:', error);
  }
};
