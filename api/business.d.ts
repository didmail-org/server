import { Request } from 'express';
import { File } from 'multer';
declare global {
  interface Staked {
    assets: GraphQLClient.IndexedAssetState[];
    token: GraphQLClient.IndexedTokenInput[] | null;
    staked: boolean;
    stakedAsset: string | null;
    stakedAssets: string[];
    revokedToken: GraphQLClient.IndexedTokenInput | null;
  }
  interface Account {
    moniker: string;
    address: string;
    token: GraphQLClient.IndexedTokenInput | null;
    endpoint: string;
  }

  interface Envelope {
    address: string;
    name: string;
    description: string;
    retentionPeriod: string;
    price: string;
    token: GraphQLClient.IndexedTokenInput;
    display: string;
    created_at: string;
    enabled: boolean;
  }

  interface Namecard {
    address: string;
    name: string;
    description: string;
    price: string;
    token: GraphQLClient.IndexedTokenInput;
    display: string;
    created_at: string;
    enabled: boolean;
  }
  interface ExtendedRequest extends Request {
    account?: {
      did: string;
      pk: string;
    };
  }
  interface Factory {
    name: string;
    address: string;
    description: string;
    limit: string;
    minted: number;
    created_at: string;
    updated_at: string;
    owner: string;
    price: string;
    token: GraphQLClient.IndexedTokenInput;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    file?: File;
    files?: File[];
  }
}

export {};
