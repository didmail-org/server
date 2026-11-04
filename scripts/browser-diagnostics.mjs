// Bounded failure evidence from disposable functional-test contexts only.
export function browserDiagnostics(page) {
  const pending = new Map();
  const navigation = [];
  let omittedRequests = 0;
  page.on('request', (request) => {
    if (pending.size < 100) pending.set(request, { url: request.url(), type: request.resourceType() });
    else omittedRequests++;
  });
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => pending.delete(request));
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigation.push(frame.url());
      if (navigation.length > 20) navigation.shift();
    }
  });
  return async () => {
    let timer;
    try {
      const documentState = await Promise.race([
        page.evaluate(() => ({ readyState: document.readyState, title: document.title })).catch(() => null),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(null), 2000);
        }),
      ]);
      return { url: page.url(), navigation, pending: [...pending.values()], omittedRequests, document: documentState };
    } finally {
      clearTimeout(timer);
    }
  };
}
