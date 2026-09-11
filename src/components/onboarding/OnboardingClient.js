'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProfileForm from '@/components/forms/ProfileForm';
import BodyMeasurementsForm from '@/components/onboarding/BodyMeasurementsForm';

const STEPS = ['Profile', 'Body'];

export default function OnboardingClient({ userId }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profileBasics, setProfileBasics] = useState(null);

  const goHome = () => router.push('/home');

  const handleProfileSaved = (basics) => {
    setProfileBasics(basics);
    setStep(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                i < step
                  ? 'bg-emerald-500 text-white'
                  : i === step
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`font-heading text-xs font-semibold ${
                i <= step ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700 mx-1" />
            )}
          </div>
        ))}
      </div>

      {step === 0 && <ProfileForm userId={userId} onSaved={handleProfileSaved} />}

      {step === 1 && profileBasics && (
        <BodyMeasurementsForm
          userId={userId}
          heightCm={profileBasics.heightCm}
          weightKg={profileBasics.weightKg}
          sex={profileBasics.sex}
          onSaved={goHome}
          onSkip={goHome}
        />
      )}
    </div>
  );
}