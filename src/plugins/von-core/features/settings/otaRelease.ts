const GITHUB_RELEASE_API = 'https://api.github.com/repos/Vondereich/VonCMS/releases/latest';
const MAX_RELEASE_RESPONSE_BYTES = 512 * 1024;
const RELEASE_REQUEST_TIMEOUT_MS = 12_000;
export const MAX_RELEASE_NOTES_CHARS = 32 * 1024;

const ALLOWED_GITHUB_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com',
]);

interface GitHubReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
  digest?: unknown;
  sha256?: unknown;
}

interface GitHubReleasePayload {
  tag_name?: unknown;
  body?: unknown;
  html_url?: unknown;
  assets?: unknown;
}

export interface OtaReleaseInfo {
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  releaseUrl: string;
  releaseNotesTruncated: boolean;
  expectedHash: string;
}

export class OtaReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OtaReleaseError';
  }
}

const readBoundedText = async (response: Response): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RELEASE_RESPONSE_BYTES) {
    throw new OtaReleaseError('The release response is too large to display safely.');
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RELEASE_RESPONSE_BYTES) {
      throw new OtaReleaseError('The release response is too large to display safely.');
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    if (bytesRead > MAX_RELEASE_RESPONSE_BYTES) {
      await reader.cancel();
      throw new OtaReleaseError('The release response is too large to display safely.');
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
};

const boundedString = (value: unknown, maximum: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maximum) : '';

const safeGitHubUrl = (value: unknown): string => {
  const candidate = boundedString(value, 2048);
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== '' ||
      !ALLOWED_GITHUB_HOSTS.has(url.hostname.toLowerCase())
    ) {
      return '';
    }
    return url.toString();
  } catch {
    return '';
  }
};

const normalizeVersion = (value: unknown): string => {
  const version = boundedString(value, 64).replace(/^v\.?/i, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new OtaReleaseError('GitHub returned an invalid release version.');
  }
  return version;
};

const parseVersion = (version: string): [number, number, number] | null => {
  const match = version.replace(/^v\.?/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

export const isNewerVersion = (local: string, remote: string): boolean => {
  const localParts = parseVersion(local);
  const remoteParts = parseVersion(remote);
  if (!localParts || !remoteParts) return false;

  for (let index = 0; index < localParts.length; index += 1) {
    if (remoteParts[index] > localParts[index]) return true;
    if (remoteParts[index] < localParts[index]) return false;
  }
  return false;
};

export const fetchLatestOtaRelease = async (): Promise<OtaReleaseInfo> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), RELEASE_REQUEST_TIMEOUT_MS);

  try {
    const response = await window.fetch(GITHUB_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OtaReleaseError('The update service is temporarily unavailable.');
    }

    let payload: GitHubReleasePayload;
    try {
      const parsed: unknown = JSON.parse(await readBoundedText(response));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid payload');
      }
      payload = parsed as GitHubReleasePayload;
    } catch (error) {
      if (error instanceof OtaReleaseError) throw error;
      throw new OtaReleaseError('GitHub returned release information in an unsupported format.');
    }

    const latestVersion = normalizeVersion(payload.tag_name);
    const assets = Array.isArray(payload.assets)
      ? (payload.assets.slice(0, 100) as GitHubReleaseAsset[])
      : [];
    const deployAsset = assets.find((asset) => {
      const name = boundedString(asset?.name, 255);
      return name.includes('Deploy') && name.endsWith('.zip');
    });
    const rawNotes = typeof payload.body === 'string' ? payload.body.trim() : '';
    const releaseNotesTruncated = rawNotes.length > MAX_RELEASE_NOTES_CHARS;

    return {
      latestVersion,
      downloadUrl: safeGitHubUrl(deployAsset?.browser_download_url),
      releaseNotes: rawNotes
        ? rawNotes.slice(0, MAX_RELEASE_NOTES_CHARS)
        : 'No release notes were provided for this version.',
      releaseUrl: safeGitHubUrl(payload.html_url),
      releaseNotesTruncated,
      expectedHash: boundedString(deployAsset?.digest ?? deployAsset?.sha256, 128),
    };
  } catch (error) {
    if (error instanceof OtaReleaseError) throw error;
    throw new OtaReleaseError('The update service is temporarily unavailable.');
  } finally {
    window.clearTimeout(timeout);
  }
};
