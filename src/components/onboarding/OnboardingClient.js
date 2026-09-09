'use client';

import { useRouter } from 'next/navigation';
import ProfileForm from '@/components/forms/ProfileForm';

export default function OnboardingClient({ userId }) {
  const router = useRouter();

  const handleSaved = () => {
    router.push('/home');
  };

  return <ProfileForm userId={userId} onSaved={handleSaved} />;
}
