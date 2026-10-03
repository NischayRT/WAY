import { redirect } from 'next/navigation';

// The Weight page is now Activity (weight + steps + distance + calories).
// Kept so old bookmarks and links still land in the right place.
export default function WeightRedirect() {
  redirect('/activity');
}
