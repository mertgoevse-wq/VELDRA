import { type LoaderFunction } from '@remix-run/cloudflare';

export function parseEditorOrigin(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  try {
    // Reject anything that isn't a clean absolute origin (no path/query/fragment/credentials).
    const parsed = new URL(rawValue);

    if (parsed.origin !== rawValue || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const editorOrigin = parseEditorOrigin(url.searchParams.get('editorOrigin'));

  if (!editorOrigin) {
    return new Response('Missing or invalid editorOrigin query parameter', { status: 400 });
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Connect to WebContainer</title>
      </head>
      <body>
        <script type="module">
          (async () => {
            const { setupConnect } = await import('https://cdn.jsdelivr.net/npm/@webcontainer/api@latest/dist/connect.js');
            setupConnect({
              editorOrigin: ${JSON.stringify(editorOrigin)}
            });
          })();
        </script>
      </body>
    </html>
  `;

  return new Response(htmlContent, {
    headers: { 'Content-Type': 'text/html' },
  });
};
