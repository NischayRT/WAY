import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchBodyAgeInputs } from '@/lib/googleHealth';
import { analyzeCurrentPhysique } from '@/lib/bodyProportions';
import { computeBodyAge, REQUIREMENTS } from '@/lib/bodyAge';
import { computeRecovery, sleepConsistencyPct } from '@/lib/readiness';
import { todayLocalDate } from '@/lib/dateUtils';

// GET /api/body-age
//
// Body Age (lib/bodyAge.js) from the last 30 days of tracker data plus the
// profile's measurements, recalculated weekly, with a 4-week trend. Shown only when EVERY prerequisite is met
// (designed around a Fitbit Air-class band syncing to Google Health);
// otherwise returns the checklist with progress so the UI can show what's left.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('age, sex, height_cm, weight_kg, waist_cm, hip_cm, chest_cm')
    .eq('id', user.id)
    .single();
  const { data: lastWeight } = await supabase
    .from('weight_logs')
    .select('weight_kg')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const age = Number(profile?.age);
  const sex = profile?.sex === 'female' ? 'female' : 'male';
  const heightCm = Number(profile?.height_cm);
  const weightKg = Number(lastWeight?.weight_kg ?? profile?.weight_kg);
  const waistCm = Number(profile?.waist_cm);
  const hipCm = Number(profile?.hip_cm);
  const profileOk = age >= 18 && heightCm > 0 && weightKg > 0;
  const measurementsOk = waistCm > 0 && (sex === 'male' || hipCm > 0);

  try {
    const accessToken = await getValidAccessToken(supabase, user.id);
    if (!accessToken) return NextResponse.json({ connected: false });

    const data = await fetchBodyAgeInputs(accessToken);
    const c = data.counts;

    // Healthspan vitals: available as soon as there is data, even while
    // Body Age itself is still locked.
    const today = todayLocalDate();
    const rec = computeRecovery(data.daily, today);
    const latest = (k) =>
      data.daily
        .filter((d) => d[k] != null)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
    const vitals = {
      readiness: rec.readiness,
      recovery: rec.recovery,
      sleepConsistency: sleepConsistencyPct(data.sleepMidpointSd30),
      hrv: latest('hrv') ? { value: Math.round(latest('hrv').hrv), date: latest('hrv').date } : null,
      rhr: latest('rhr') ? { value: Math.round(latest('rhr').rhr), date: latest('rhr').date } : null,
    };
    const have = { profile: profileOk ? 1 : 0, measurements: measurementsOk ? 1 : 0, ...c };
    const requirements = REQUIREMENTS.map((r) => {
      const need = r.min ?? 1;
      const got = have[r.key] ?? 0;
      const req = { key: r.key, label: r.label, have: got, need, met: got >= need };
      if (r.key === 'sleep' && data.needsPermission.sleep) req.action = 'allow-sleep';
      if (r.key === 'measurements' && !measurementsOk) req.action = 'measurements';
      if (r.key === 'profile' && !profileOk) req.action = 'profile';
      return req;
    });
    const eligible = requirements.every((r) => r.met);

    if (!eligible) {
      return NextResponse.json(
        { connected: true, eligible: false, requirements, vitals },
        { headers: { 'Cache-Control': 'private, max-age=600' } }
      );
    }

    const physique = analyzeCurrentPhysique({ heightCm, weightKg, sex, waistCm, hipCm, chestCm: Number(profile?.chest_cm) || undefined });
    const leanPct = physique?.bodyFatPct != null ? 100 - physique.bodyFatPct : null;
    const body = { leanPct, whtr: waistCm / heightCm };

    const result = computeBodyAge({
      age,
      sex,
      long: { ...data.long, ...body },
      recent: data.recent,
    });
    // Body Age at the end of each of the last 4 weeks (each its own 30 days).
    const trend = data.snapshots.map((snap) => {
      const ok = snap.values.steps != null && snap.values.restingHr != null && snap.values.sleepHours != null;
      return {
        end: snap.end,
        bodyAge: ok ? computeBodyAge({ age, sex, long: { ...snap.values, ...body }, recent: {} }).bodyAge : null,
      };
    });

    return NextResponse.json(
      {
        connected: true,
        eligible: true,
        requirements,
        result: { ...result, trend },
        vitals,
        basis: { days: c.wornDays, vo2Date: data.latestVo2Date, bodyFatPct: physique?.bodyFatPct ?? null },
      },
      // Recalculated weekly from 30 days: an hour of private caching is plenty.
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    );
  } catch (err) {
    if (err.reauthRequired) return NextResponse.json({ connected: false, reauthRequired: true }, { status: 401 });
    console.error('[body-age]', err?.message);
    return NextResponse.json({ error: 'Could not calculate Body Age' }, { status: 500 });
  }
}
