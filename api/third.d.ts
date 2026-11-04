declare module 'express-history-api-fallback';

declare module 'express-async-errors';

declare module 'express-cache-headers';

declare module 'country-flag-icons/unicode';
declare module 'country-flag-icons/string/3x2';

namespace Express {
  interface Request {
    user?: {
      did: string;
      role: string;
      fullName: string;
      provider: string;
      walletOS: string;
    };
  }
}
