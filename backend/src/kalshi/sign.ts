import crypto from 'node:crypto';

/**
 * Normalise the private key the operator supplied. We accept either:
 *   1. A PEM string with real or literal-`\n` newlines.
 *   2. A base64-encoded blob of the entire .pem file.
 */
export function normalizePrivateKey(raw: string): string {
  const withNewlines = raw.includes('-----BEGIN')
    ? raw.replace(/\\n/g, '\n')
    : Buffer.from(raw, 'base64').toString('utf8');

  if (!withNewlines.includes('-----BEGIN')) {
    throw new Error(
      'KALSHI_PRIVATE_KEY does not look like a PEM key (no -----BEGIN----- header). ' +
        'Paste the PEM with \\n escaped newlines, or base64-encode the whole .pem file.',
    );
  }
  return withNewlines;
}

/**
 * Kalshi API-key auth: sign `timestamp + METHOD + path` with RSA-PSS/SHA-256.
 * `path` is the request path only (no query string, no host), e.g.
 * `/trade-api/v2/portfolio/orders`.
 *
 * Returns the headers Kalshi expects on every authenticated request.
 */
export function signRequest(params: {
  privateKeyPem: string;
  apiKeyId: string;
  method: string;
  path: string;
  timestampMs?: number;
}): Record<string, string> {
  const timestamp = String(params.timestampMs ?? Date.now());
  const method = params.method.toUpperCase();
  const message = `${timestamp}${method}${params.path}`;

  const signature = crypto
    .sign('sha256', Buffer.from(message, 'utf8'), {
      key: params.privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    })
    .toString('base64');

  return {
    'KALSHI-ACCESS-KEY': params.apiKeyId,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
  };
}
