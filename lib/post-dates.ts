// YAML may roll invalid bare dates into the next month; validate the original scalar too.
export function parseUpdatedDate(value: unknown, published: Date | null, frontmatter: string): Date | null {
  if (value === undefined) return null;

  const text = value instanceof Date
    ? frontmatter.match(/^[ \t]*(?:updated|'updated'|"updated")[ \t]*:[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*(?:#.*)?$/m)?.[1]
    : typeof value === "string" ? value.trim() : undefined;
  const updated = text && /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000Z`)
    : null;

  if (!text || !updated || Number.isNaN(updated.getTime()) || updated.toISOString().slice(0, 10) !== text) {
    throw new Error('frontmatter "updated" must be a valid YYYY-MM-DD date');
  }
  if (!published || Number.isNaN(published.getTime())) {
    throw new Error('frontmatter "updated" requires a valid publication "date"');
  }
  if (text < published.toISOString().slice(0, 10)) {
    throw new Error('frontmatter "updated" must not be earlier than "date"');
  }
  return updated;
}
