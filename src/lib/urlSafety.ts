export interface HostPolicy {
  exact?: readonly string[];
  suffix?: readonly string[];
}

export const ARTICLE_SOURCE_HOSTS = {
  zenn: { exact: ['zenn.dev'] },
  qiita: { exact: ['qiita.com'] },
  prtimes: { suffix: ['prtimes.jp'] },
  sizu: { exact: ['sizu.me'] },
} satisfies Record<string, HostPolicy>;

export const GITHUB_HOSTS: HostPolicy = {
  exact: ['github.com', 'www.github.com'],
};

export const SPEAKERDECK_HOSTS: HostPolicy = {
  exact: ['speakerdeck.com', 'www.speakerdeck.com'],
};

function matchesHostPolicy(hostname: string, policy?: HostPolicy): boolean {
  if (!policy) {
    return true;
  }

  const normalizedHost = hostname.toLowerCase();
  const exact = policy.exact ?? [];
  const suffix = policy.suffix ?? [];

  if (exact.length === 0 && suffix.length === 0) {
    return true;
  }

  return exact.some((host) => normalizedHost === host)
    || suffix.some((host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`));
}

export function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function normalizeAllowedHttpsUrl(value: string, policy?: HostPolicy): string | null {
  const url = parseHttpsUrl(value);
  if (!url || !matchesHostPolicy(url.hostname, policy)) {
    return null;
  }
  return url.toString();
}

export function isAllowedHttpsUrl(value: string, policy?: HostPolicy): boolean {
  return normalizeAllowedHttpsUrl(value, policy) !== null;
}

export function isSafeSlidePdfPath(value: string): boolean {
  return /^\/slides\/[A-Za-z0-9._/-]+\.pdf$/i.test(value)
    && !value.includes('..')
    && !value.includes('//');
}
