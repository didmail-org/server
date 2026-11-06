import { Router } from 'express';
import { getAttachmentConfig, setAttachmentConfig } from '../../../storage/database';

const router = Router();

const isPositiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const isPricePerBytePerDay = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && /^\d+$/.test(value);

const toConfigJson = (config: Awaited<ReturnType<typeof getAttachmentConfig>>) => ({
  maxFileSizeBytes: config.get('maxFileSizeBytes'),
  maxFileCount: config.get('maxFileCount'),
  pricePerBytePerDay: config.get('pricePerBytePerDay'),
  updatedAt: config.get('updatedAt'),
});

router.get('/attachment-config', async (_req, res) => {
  const config = await getAttachmentConfig();
  return res.json(toConfigJson(config));
});

router.put('/attachment-config', async (req, res) => {
  const { maxFileSizeBytes, maxFileCount, pricePerBytePerDay } = req.body ?? {};

  if (maxFileSizeBytes !== undefined && !isPositiveInt(maxFileSizeBytes)) {
    return res.status(400).json({ message: 'maxFileSizeBytes must be a positive integer' });
  }
  if (maxFileCount !== undefined && !isPositiveInt(maxFileCount)) {
    return res.status(400).json({ message: 'maxFileCount must be a positive integer' });
  }
  if (pricePerBytePerDay !== undefined && !isPricePerBytePerDay(pricePerBytePerDay)) {
    return res.status(400).json({ message: 'pricePerBytePerDay must be a non-empty numeric string of digits only' });
  }

  if (maxFileSizeBytes === undefined && maxFileCount === undefined && pricePerBytePerDay === undefined) {
    return res.status(400).json({ message: 'At least one attachment config field is required' });
  }

  const config = await setAttachmentConfig({
    ...(maxFileSizeBytes !== undefined ? { maxFileSizeBytes } : {}),
    ...(maxFileCount !== undefined ? { maxFileCount } : {}),
    ...(pricePerBytePerDay !== undefined ? { pricePerBytePerDay } : {}),
  });

  return res.json(toConfigJson(config));
});

export default router;
