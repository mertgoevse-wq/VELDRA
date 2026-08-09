#!/bin/bash

# Exit on any error
set -e

echo "Starting VELDRA update process..."

# Resolve an absolute project path so backup containment checks are reliable.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Store current version without requiring jq.
CURRENT_VERSION=$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PROJECT_ROOT/package.json" | head -1)

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not determine the current VELDRA version" >&2
    exit 1
fi

echo "Current version: $CURRENT_VERSION"
echo "Fetching latest release..."

if [ -z "${GITHUB_TOKEN:-}" ] && [ -z "${GH_TOKEN:-}" ]; then
    echo "Error: Set GITHUB_TOKEN or GH_TOKEN to access private VELDRA releases" >&2
    exit 1
fi

AUTH_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
API_RESPONSE=$(curl --fail-with-body --silent --show-error \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/mertgoevse-wq/VELDRA/releases/latest)

# Select a ZIP and a matching SHA-256 checksum asset from the trusted API response.
ASSET_INFO=$(API_RESPONSE="$API_RESPONSE" node <<'NODE'
const release = JSON.parse(process.env.API_RESPONSE);
const assets = Array.isArray(release.assets) ? release.assets : [];
const zip = assets.find((asset) => typeof asset.name === 'string' && asset.name.endsWith('.zip'));
const checksum = zip && assets.find((asset) => asset.name === `${zip.name}.sha256`);

if (!zip || !checksum) {
  process.exit(1);
}

process.stdout.write(`${zip.browser_download_url}\t${checksum.browser_download_url}`);
NODE
) || {
    echo "Error: Latest VELDRA release must include a ZIP and matching SHA-256 asset" >&2
    exit 1
}

IFS=$'\t' read -r LATEST_RELEASE_URL CHECKSUM_URL <<< "$ASSET_INFO"
case "$LATEST_RELEASE_URL" in
    https://github.com/mertgoevse-wq/VELDRA/releases/download/*.zip) ;;
    *)
        echo "Error: Release asset URL is outside the canonical VELDRA release host" >&2
        exit 1
        ;;
esac
case "$CHECKSUM_URL" in
    https://github.com/mertgoevse-wq/VELDRA/releases/download/*) ;;
    *)
        echo "Error: Checksum asset URL is outside the canonical VELDRA release host" >&2
        exit 1
        ;;
esac

# Create a temporary directory and always clean it up.
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

echo "Downloading latest release..."
curl --fail --location --silent --show-error \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Accept: application/octet-stream" \
    -o latest.zip "$LATEST_RELEASE_URL"
curl --fail --location --silent --show-error \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Accept: text/plain" \
    -o SHA256SUMS "$CHECKSUM_URL"

EXPECTED_SHA256=$(sed -n "s/^\([0-9a-fA-F]\{64\}\)[[:space:]]\+$(basename "$LATEST_RELEASE_URL")$/\1/p" SHA256SUMS | head -1)
if [ -z "$EXPECTED_SHA256" ]; then
    echo "Error: Checksum asset does not contain a SHA-256 digest" >&2
    exit 1
fi
ACTUAL_SHA256=$(sha256sum latest.zip | awk '{print $1}')
if [ "${EXPECTED_SHA256,,}" != "${ACTUAL_SHA256,,}" ]; then
    echo "Error: Downloaded release checksum does not match" >&2
    exit 1
fi

# Reject absolute paths and traversal entries before extraction.
if unzip -Z1 latest.zip | grep -Eq '(^/|(^|/)\.\.?(/|$))'; then
    echo "Error: Release archive contains an unsafe path" >&2
    exit 1
fi

echo "Extracting update..."
unzip -q latest.zip -d extracted

# Do not install links or special files from an untrusted release archive.
if find extracted -type l -o -type b -o -type c -o -type p -o -type s | grep -q .; then
    echo "Error: Release archive contains links or special files" >&2
    exit 1
fi

if [ ! -f extracted/package.json ]; then
    echo "Error: Release archive must contain package.json at its root" >&2
    exit 1
fi

# Backup outside the project by default. Custom locations inside the project are rejected.
BACKUP_ROOT="${VELDRA_BACKUP_DIR:-$(dirname "$PROJECT_ROOT")}"
mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd)"
case "$BACKUP_ROOT/" in
    "$PROJECT_ROOT/"*)
        echo "Error: VELDRA_BACKUP_DIR must be outside the project directory" >&2
        exit 1
        ;;
esac

# Backup current installation, excluding secrets, VCS metadata and generated dependencies.
echo "Creating backup..."
BACKUP_DIR="$BACKUP_ROOT/veldra-backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
tar --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='.env.*' \
    -cf - -C "$PROJECT_ROOT" . | tar -xf - -C "$BACKUP_DIR"

# Install only the validated release payload. Existing local environment files remain untouched.
echo "Installing update..."
tar --exclude='.env' --exclude='.env.*' --exclude='.git' \
    -cf - -C extracted . | tar -xf - -C "$PROJECT_ROOT"

cd "$PROJECT_ROOT"
echo "Update completed successfully!"
echo "Please restart the application to apply the changes."

exit 0
