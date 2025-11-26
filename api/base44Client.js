import { createClient } from './../sdk';
import { appParams } from '@/lib/app-params';
const { serverUrl } = appParams;
export const base44 = createClient({
  serverUrl,
});