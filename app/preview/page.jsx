import { redirect } from 'next/navigation';

/** No token: send them to their most recent draft. */
export default function PreviewIndex() {
  // HOOK: look up the signed-in user's latest draft token.
  redirect('/preview/demo');
}
