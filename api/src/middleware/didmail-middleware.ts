import { fromPublicKey } from '@ocap/wallet';
import { Response, NextFunction } from 'express';

const didMiddleware = (req: ExtendedRequest, res: Response, next: NextFunction) => {
  const did = req.headers['x-didmail-did'] as string;
  const pk = req.headers['x-didmail-pk'] as string;

  if (!did || !pk) {
    return res.status(401).json({ error: 'Unauthorized: Missing DID or public key' });
  }
  const wallet = fromPublicKey(pk);
  if (wallet.address !== did) {
    return res.status(401).json({ error: 'Unauthorized: Invalid public key' });
  }
  req.account = {
    did,
    pk,
  };

  next();
  return undefined;
};

export default didMiddleware;
