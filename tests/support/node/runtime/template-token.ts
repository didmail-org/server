import { getForgeState } from '../../../../blocklet/providers/didmail-http/source/api/src/libs/forge';

export default async function templateToken() {
  const forge = await getForgeState();
  return forge?.token;
}
