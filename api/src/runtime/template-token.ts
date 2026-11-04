import { getForgeState } from '../libs/forge';

export default async function templateToken() {
  const forge = await getForgeState();
  return forge?.token;
}
