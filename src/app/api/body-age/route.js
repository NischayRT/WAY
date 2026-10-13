import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { getValidAccessToken, fetchBodyAgeInputs, getGrantedScopes, OPTIONAL_SCOPES, BODY_AGE_MIN_DAYS, BODY_AGE_MAX_DAYS } from '@/lib/googleHealth';
import { analyzeCurrentPhysique } from '@/lib/bodyProportions';
import { computeBodyAge, requirementsFor } from '@/lib/bodyAge';
import { computeRecovery, sleepConsistencyPct } from '@/lib/readiness';
import { todayLocalDate, addDays, isValidDateStr } from '@/lib/dateUtils';

// GET /api/body-age?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Body Age (lib/bodyAge.js) over the chosen range (7..180 days; default the
// last 7 days) plus the profile's measurements, with a 4-week trend. Shown
// only when EVERY prerequisite is met (they scale with the range: 5 of 7
// days, 21 of 30, ...); otherwise returns the checklist with progress.
const spanDays = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000) + 1;

export async function GET(request) {
  const today = todayLocalDate();
  const { searchParams } = new URL(request.url);
  const qTo = searchParams.get('to');
  const qFrom = searchParams.get('from');
  const to = isValidDateStr(qTo) && qTo < today ? qTo : today;
  const from = isValidDateStr(qFrom) && qFrom <= to ? qFrom : addDays(to, -(BODY_AGE_MIN_DAYS - 1));
  const windowDays = Math.max(BODY_AGE_MIN_DAYS, Math.min(BODY_AGE_MAX_DAYS, spanDays(from, to)));

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

    const [data, granted] = await Promise.all([
      fetchBodyAgeInputs(accessToken, { to, windowDays }),
      getGrantedScopes(supabase, user.id),
    ]);
    const c = data.counts;

    // Healthspan vitals: available as soon as there is data, even while
    // Body Age itself is still locked.
    const rec = computeRecovery(data.daily, to);
    const latest = (k) =>
      data.daily
        .filter((d) => d[k] != null)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
    const vitals = {
      readiness: rec.readiness,
      recovery: rec.recovery,
      // Over the selected range (it used to be a fixed 30 days, so it never moved).
      sleepConsistency: sleepConsistencyPct(data.sleepTiming?.sdMin),
      sleepTiming: data.sleepTiming,
      hrv: latest('hrv') ? { value: Math.round(latest('hrv').hrv), date: latest('hrv').date } : null,
      rhr: latest('rhr') ? { value: Math.round(latest('rhr').rhr), date: latest('rhr').date } : null,
    };
    const have = { profile: profileOk ? 1 : 0, measurements: measurementsOk ? 1 : 0, ...c };
    const sleepGranted = granted.has(OPTIONAL_SCOPES.sleep);
    const requirements = requirementsFor(windowDays).map((r) => {
      const need = r.min ?? 1;
      const got = have[r.key] ?? 0;
      const req = { key: r.key, label: r.label, have: got, need, met: got >= need };
      // Google refused the sleep request. If the stored grant doesn't include
      // sleep, ask for it; if it does, the fault is on Google's side (e.g. the
      // scope isn't enabled for this Cloud project) and re-asking won't help.
      if (r.key === 'sleep' && data.needsPermission.sleep) req.action = sleepGranted ? 'sleep-blocked' : 'allow-sleep';
      if (!req.met && !req.action && data.failed?.[r.key]) req.action = 'read-error';
      if (r.key === 'measurements' && !measurementsOk) req.action = 'measurements';
      if (r.key === 'profile' && !profileOk) req.action = 'profile';
      return req;
    });
    const eligible = requirements.every((r) => r.met);

    const span = { from: data.from, to: data.to, days: data.windowDays };

    if (!eligible) {
      // Never cached: after granting a permission or syncing the band, the
      // next load must re-check (a cached "locked" reply is why "Allow sleep
      // access" seemed to do nothing).
      return NextResponse.json(
        { connected: true, eligible: false, requirements, vitals, window: span, sources: data.sourceCounts },
        { headers: { 'Cache-Control': 'no-store' } }
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
      windowDays: data.windowDays,
      paceBase: data.paceBase ? { ...data.paceBase, ...body } : null,
    });
    // Body Age at the end of each of the last 4 weeks (each over the same window length).
    const trend = data.snapshots.map((snap) => {
      const ok = snap.values.steps != null && snap.values.restingHr != null && snap.values.sleepHours != null;
      return {
        end: snap.end,
        bodyAge: ok ? computeBodyAge({ age, sex, long: { ...snap.values, ...body }, recent: {}, windowDays: data.windowDays }).bodyAge : null,
      };
    });

    return NextResponse.json(
      {
        connected: true,
        eligible: true,
        requirements,
        result: { ...result, trend },
        vitals,
        window: span,
        basis: { days: c.wornDays, vo2Date: data.latestVo2Date, bodyFatPct: physique?.bodyFatPct ?? null },
      },
      { headers: { 'Cache-Control': 'private, max-age=600' } }
    );
  } catch (err) {
    if (err.reauthRequired) return NextResponse.json({ connected: false, reauthRequired: true }, { status: 401 });
    console.error('[body-age]', err?.message);
    return NextResponse.json({ error: 'Could not calculate Body Age' }, { status: 500 });
  }
}
