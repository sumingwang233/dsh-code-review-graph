/** Inline only bundled scripts and local data; the iframe never fetches remote assets. */
export async function inlineGraph(html: string, read: (path: string) => Promise<string>): Promise<string> {
  // The upstream CDN fallback contains a literal script tag inside a JS string.
  // Local D3 is required here, so remove that loader before inspecting HTML tags.
  html = html.replace(/<script>\s*window\.d3\s*\|\|\s*document\.write\([\s\S]*?\);\s*<\/script>/gi, '');
  const scripts = [...html.matchAll(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>[\s\S]*?<\/script>/gi)];
  for (const match of scripts) {
    const path = match[2];
    if (/^(?:https?:|data:|\/|\\)|\.\./i.test(path)) throw new Error('Graph contains a nonlocal script');
    const script = await read(path);
    html = html.replace(match[0], () => `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`);
  }
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'">`;
  return html.replace(/<head>/i, `<head>${policy}`);
}
