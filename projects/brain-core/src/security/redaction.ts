const SECRET_PATTERNS = [
  /api[_-]?key/gi,
  /token/gi,
  /secret/gi,
  /password/gi,
  /authorization/gi,
];

export function redactKeyValue(key: string, value: unknown): unknown {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(key)) && (typeof value === 'string' || (typeof value === 'object' && value !== null))) {
    return '[REDACTED]';
  }

  return value;
}

export function redactingJsonReplacer(key: string, value: unknown): unknown {
  return redactKeyValue(key, value);
}
