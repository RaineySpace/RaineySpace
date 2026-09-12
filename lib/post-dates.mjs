/**
 * Validate the optional update date for both the content reader and CLI validator.
 * gray-matter's YAML parser turns bare dates into Date objects and can roll an
 * invalid date into the next month, so retain the original scalar for that case.
 * @param {unknown} value
 * @param {Date | null} published
 * @param {string} frontmatter
 * @returns {Date | null}
 */
export function parseUpdatedDate(value, published, frontmatter) {
  if (value === undefined) return null;

  const text = value instanceof Date
    ? frontmatter.match(/^[ \t]*(?:updated|'updated'|"updated")[ \t]*:[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*(?:#.*)?$/m)?.[1]
    : typeof value === "string" ? value.trim() : undefined;
  const updated = text && /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00.000Z`)
    : null;

  if (!updated || Number.isNaN(updated.getTime()) || updated.toISOString().slice(0, 10) !== text) {
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
