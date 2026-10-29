import { redirect } from 'next/navigation';

// Friends is now Compete. Old links and bookmarks keep working.
export default async function FriendsRedirect({ searchParams }) {
  const params = await searchParams;
  const tab = typeof params?.tab === 'string' && /^[a-z]{1,20}$/.test(params.tab) ? `?tab=${params.tab}` : '';
  redirect(`/compete${tab}`);
}
