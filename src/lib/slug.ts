/** Pure, dependency-free — shared by server (ToolsSection) and client (Sidebar) code. */
export const slugifyLabel = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
