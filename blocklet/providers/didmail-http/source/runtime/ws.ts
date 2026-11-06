// DIDMail uses request/response GraphQL only; exclude the SDK's unrelated cluster server.
export class WsClient {
  constructor() {
    throw new Error('Chain subscriptions are not used by DIDMail Workers');
  }
}
