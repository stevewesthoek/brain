const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#172033"/><path d="M16 6c-4.7 0-8.5 3.5-8.5 7.8 0 2.6 1.4 4.9 3.6 6.3V25h9.8v-4.9c2.2-1.4 3.6-3.7 3.6-6.3C24.5 9.5 20.7 6 16 6Z" fill="#7dd3fc"/><circle cx="12.5" cy="14" r="1.5" fill="#172033"/><circle cx="19.5" cy="14" r="1.5" fill="#172033"/></svg>';

export function GET() {
  return new Response(FAVICON, {
    headers: {
      'cache-control': 'public, max-age=86400',
      'content-type': 'image/svg+xml',
    },
  });
}
