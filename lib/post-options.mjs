/** @param {unknown} value @param {string} field @param {boolean} fallback */
function booleanOption(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new Error(`frontmatter "${field}" must be a boolean`);
  }
  return value;
}

/** Shared by the content reader, validator and static header generator.
 * @param {Record<string, unknown>} data
 */
export function parsePostOptions(data) {
  return {
    noindex: booleanOption(data.noindex, 'noindex', false),
    showHeader: booleanOption(data.showHeader, 'showHeader', true),
  };
}
