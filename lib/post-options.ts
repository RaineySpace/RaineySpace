function booleanOption(value: unknown, field: string, fallback: boolean) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`frontmatter "${field}" must be a boolean`);
  }
  return value;
}

export function parsePostOptions(data: Record<string, unknown>) {
  return {
    noindex: booleanOption(data.noindex, 'noindex', false),
    showHeader: booleanOption(data.showHeader, 'showHeader', true),
  };
}
