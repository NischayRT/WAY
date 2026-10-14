'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scale } from 'lucide-react';
import { createClient } from '@/lib/supabaseClient';
import { getCurrentUserId } from '@/lib/currentUser';
import { syncToGoogleHealth } from '@/lib/googleHealthSyncClient';
import { Btn, Modal } from './ui';

const dayLabel = (date, today) =>
  date === today
    ? 'today'
    : new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Log (or update) the weigh-in for one date. Today's entry also updates the
 * profile weight, which recalibrates the daily targets.
 */
export default function WeightLogDialog(props) {
  // Mounted only while open, so it always starts from the current weight.
  return props.open ? <WeightLogPanel {...props} /> : null;
}

function WeightLogPanel({ onClose, date, today, currentWeight, onSaved }) {
  const supabase = createClient();
  const router = useRouter();
  const [value, setValue] = useState(currentWeight ? String(Number(currentWeight).toFixed(1)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    const kg = parseFloat(value);
    if (!(kg > 20 && kg < 400)) {
      setError('Enter a weight between 20 and 400 kg.');
      return;
    }
    setSaving(true);
    setError(null);
    let userId;
    try {
      userId = await getCurrentUserId(supabase);
    } catch (e) {
      setSaving(false);
      setError(e.message);
      return;
    }
    const { error: logError } = await supabase
      .from('weight_logs')
      .upsert({ user_id: userId, weight_kg: kg, logged_at: date }, { onConflict: 'user_id,logged_at' });
    if (logError) {
      setSaving(false);
      setError(logError.message);
      return;
    }
    syncToGoogleHealth({ action: 'weight_upsert', date });
    if (date === today) {
      const { error: profileError } = await supabase.from('profiles').update({ weight_kg: kg }).eq('id', userId);
      if (profileError) {
        setSaving(false);
        setError(profileError.message);
        return;
      }
    }
    setSaving(false);
    onSaved?.(kg);
    onClose();
    router.refresh();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={420}
      title={`Log weight · ${dayLabel(date, today)}`}
      subtitle={date === today ? 'Updates your daily targets too.' : 'Adds to your trend for that day.'}
      footer={
        <>
          <Btn variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Btn>
          <Btn variant="primary" onClick={save} disabled={saving} className="flex-[2]">
            <Scale size={14} />
            {saving ? 'Saving…' : 'Save weight'}
          </Btn>
        </>
      }
    >
      <label className="flex flex-col gap-2 text-xs text-way-mute">
        Weight
        <span className="flex h-14 items-center gap-2 rounded-[14px] border border-way-line3 bg-way-page px-4 focus-within:border-way-mute">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="way-num w-full bg-transparent font-mono text-2xl font-semibold text-way-ink outline-none"
          />
          <span className="font-mono text-sm text-way-dim">kg</span>
        </span>
      </label>
      {error ? <p className="mt-3 text-[13px] text-rose-300">{error}</p> : null}
    </Modal>
  );
}
