// Synthetic ARC users and business scenarios do not exercise ARC screenshot
// tools or third-party fonts. Resolve those resources locally so CDN failures
// cannot block document parsing or a later same-origin navigation.
export async function isolateBrowserResources(context) {
  await context.route(
    (url) => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname),
    (route) => route.fulfill({ contentType: 'text/css', body: '' }),
  );
  await context.route('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: '/* ARC screenshot tool excluded from business fixtures. */',
    }),
  );
  await context.route('**/.well-known/service/user/avatar/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="14" fill="#64748b"/></svg>',
    }),
  );
}
