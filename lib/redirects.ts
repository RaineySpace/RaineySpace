/** Match Pages: a target query wins, otherwise retain the incoming query. */
export function redirectTarget(target: string, source: string) {
  const from = new URL(source);
  const to = new URL(target, from);
  if (!to.search) to.search = from.search;
  // HTTP redirects inherit an incoming fragment when the target has none.
  if (!to.hash && !target.includes('#')) to.hash = from.hash;
  return to.href;
}
