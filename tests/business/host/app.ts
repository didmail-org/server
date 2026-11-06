// Test-container HTTP adapter. Never distributed in the native Blocklet.
import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { createLegacyApp } from '../../../blocklet/providers/didmail-http/source/http/app-factory';
const server = createServer(createLegacyApp());
server.listen(8080);
export default httpServerHandler({ port: 8080 });
