/** Same-page bridge: Sidebar category clicks and the homepage's ToolDirectoryGrid
 * live in different parts of the tree. A URL hash alone doesn't work here — Next's
 * router uses history.pushState for same-route link clicks, which never fires
 * `hashchange`, so a hash-only click while already on `/` would otherwise do nothing. */
export const CATEGORY_SELECT_EVENT = 'sv:selectCategory';

export function dispatchCategorySelect(slug: string): void {
  window.dispatchEvent(new CustomEvent<string>(CATEGORY_SELECT_EVENT, { detail: slug }));
}
