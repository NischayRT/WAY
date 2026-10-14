import { redirect } from 'next/navigation';

// The Physique Studio now lives in Settings → Body.
export default function BodyStudioPage() {
  redirect('/settings?tab=body');
}
