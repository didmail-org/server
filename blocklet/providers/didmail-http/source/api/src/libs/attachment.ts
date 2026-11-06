import { getHasher, types } from '@ocap/mcrypto';
import { Attachment, getAttachmentConfig } from '../../../storage/database';

export interface AttachmentInput {
  id: string;
  encryptedName: string;
  encryptedMime: string;
  size: number; // plaintext bytes
  hash: string; // SHA3-256(encrypted).slice(-64).toUpperCase()
  buffer: Buffer; // encrypted bytes
}

const hashFn = getHasher(types.HashType.SHA3);
const encoder = new TextEncoder();

const ATTACHMENT_ID_CONFLICT = 'ATTACHMENT_ID_CONFLICT';

const isAttachmentConflictError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const error = err as { code?: string; name?: string };
  return error.code === ATTACHMENT_ID_CONFLICT || error.name === 'SequelizeUniqueConstraintError';
};

const parseAttachmentMeta = (attachmentMetaRaw: unknown): unknown[] => {
  if (attachmentMetaRaw === undefined || attachmentMetaRaw === null || attachmentMetaRaw === '') {
    return [];
  }

  let parsed: unknown = attachmentMetaRaw;
  if (typeof attachmentMetaRaw === 'string') {
    try {
      parsed = JSON.parse(attachmentMetaRaw);
    } catch {
      throw new Error('attachmentMeta must be a valid JSON array');
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('attachmentMeta must be a JSON array');
  }

  return parsed;
};

const parseAttachmentInputs = (
  files: Express.Multer.File[] | undefined,
  attachmentMetaRaw: unknown,
): AttachmentInput[] => {
  const fileList = files ?? [];
  const metaList = parseAttachmentMeta(attachmentMetaRaw);

  if (fileList.length === 0 && metaList.length === 0) {
    return [];
  }

  if (fileList.length === 0 || metaList.length === 0) {
    throw new Error('attachment files and attachmentMeta must both be provided and non-empty');
  }

  if (fileList.length !== metaList.length) {
    throw new Error(
      `attachment count mismatch: received ${fileList.length} file(s) and ${metaList.length} meta entr(y/ies)`,
    );
  }

  const seenIds = new Set<string>();
  const inputs: AttachmentInput[] = [];

  for (let i = 0; i < metaList.length; i += 1) {
    const meta = metaList[i];
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      throw new Error(`attachmentMeta[${i}] must be an object`);
    }

    const record = meta as Record<string, unknown>;
    const { id, encryptedName, encryptedMime, size, hash } = record;

    if (typeof id !== 'string' || !id) {
      throw new Error(`attachmentMeta[${i}].id is required`);
    }
    if (typeof encryptedName !== 'string' || !encryptedName) {
      throw new Error(`attachmentMeta[${i}].encryptedName is required`);
    }
    if (typeof encryptedMime !== 'string' || !encryptedMime) {
      throw new Error(`attachmentMeta[${i}].encryptedMime is required`);
    }
    if (typeof size !== 'number' || !Number.isFinite(size)) {
      throw new Error(`attachmentMeta[${i}].size must be a number`);
    }
    if (typeof hash !== 'string' || !hash) {
      throw new Error(`attachmentMeta[${i}].hash is required`);
    }
    if (seenIds.has(id)) {
      throw new Error(`duplicate attachment id: ${id}`);
    }
    seenIds.add(id);

    const file = fileList[i]!;
    inputs.push({
      id,
      encryptedName,
      encryptedMime,
      size,
      hash,
      buffer: file.buffer,
    });
  }

  return inputs;
};

const validateAttachments = async (inputs: AttachmentInput[]): Promise<void> => {
  const config = await getAttachmentConfig();
  const maxFileCount = config.get('maxFileCount') as number;
  const maxFileSizeBytes = config.get('maxFileSizeBytes') as number;

  if (inputs.length > maxFileCount) {
    throw new Error(`too many attachments: ${inputs.length} exceeds maxFileCount ${maxFileCount}`);
  }

  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i]!;
    if (input.buffer.length > maxFileSizeBytes) {
      throw new Error(`attachment[${i}] exceeds maxFileSizeBytes: ${input.buffer.length} > ${maxFileSizeBytes}`);
    }
    if (input.size < 1) {
      throw new Error(`attachment[${i}].size must be >= 1`);
    }
    if (input.size !== input.buffer.length - 40) {
      throw new Error(
        `attachment[${i}].size must equal encrypted length - 40 (got size=${input.size}, encrypted=${input.buffer.length})`,
      );
    }
    const expectedHash = hashFn(input.buffer, 1).slice(-64).toUpperCase();
    if (input.hash !== expectedHash) {
      throw new Error(`attachment[${i}].hash mismatch`);
    }
  }
};

const storeAttachments = async (mailId: number, inputs: AttachmentInput[]): Promise<void> => {
  if (inputs.length === 0) {
    return;
  }

  try {
    await Attachment.bulkCreate(
      inputs.map((input) => ({
        id: input.id,
        mailId,
        encryptedName: input.encryptedName,
        encryptedMime: input.encryptedMime,
        size: input.size,
        hash: input.hash,
        content: input.buffer,
      })),
    );
  } catch (err) {
    if (isAttachmentConflictError(err)) {
      const conflict = new Error('Attachment id already exists') as Error & { code: string };
      conflict.code = ATTACHMENT_ID_CONFLICT;
      conflict.name = 'AttachmentConflictError';
      throw conflict;
    }
    throw err;
  }
};

const buildAttachmentMeta = (
  inputs: Array<Pick<AttachmentInput, 'id' | 'encryptedName' | 'encryptedMime' | 'size' | 'hash'>>,
): object[] =>
  inputs.map(({ id, encryptedName, encryptedMime, size, hash }) => ({
    id,
    encryptedName,
    encryptedMime,
    size,
    hash,
  }));

const computeMailHashWithAttachments = (params: {
  did: string;
  receiver: string;
  subjectArray: Uint8Array;
  contentArray: Uint8Array;
  envelope: string;
  attachments: AttachmentInput[];
}): string => {
  const parts: number[] = [
    ...encoder.encode(params.did),
    ...encoder.encode(params.receiver),
    ...params.subjectArray,
    ...params.contentArray,
    ...encoder.encode(params.envelope),
  ];

  for (const attachment of params.attachments) {
    parts.push(
      ...encoder.encode(attachment.id),
      ...encoder.encode(String(attachment.size)),
      ...encoder.encode(attachment.hash),
    );
  }

  return hashFn(new Uint8Array(parts), 1).slice(-64).toUpperCase();
};

export {
  parseAttachmentInputs,
  validateAttachments,
  storeAttachments,
  buildAttachmentMeta,
  computeMailHashWithAttachments,
  isAttachmentConflictError,
  ATTACHMENT_ID_CONFLICT,
};
