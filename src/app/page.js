import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  Soup,
  Coffee,
  Wheat,
  Flame,
  CookingPot,
  Leaf,
  ArrowRight,
  ShieldCheck,
  Utensils,
  Scale,
  Footprints,
  Target,
  Sparkles,
} from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { LEGAL } from '@/lib/legal';
import BodyShowcase from '@/components/landing/BodyShowcase';
import styles from './landing.module.css';

// Public homepage. Visitors who are not signed in (including Google's
// verification reviewers) see what the app is for without logging in;
// signed-in users go straight to their dashboard.
//
// Server Component + CSS module: the whole page, including its animations,
// is in the first HTML response. Only the 3D showcase hydrates, and its
// three.js bundle loads when it scrolls into view.
export const metadata = {
  title: { absolute: 'WAY Studio — Indian food diet & physique tracker' },
  description:
    'WAY Studio is a free web app for tracking calories and macros of Indian food, logging your weight, and viewing your progress in 3D. Optional Google Health sync.',
  alternates: { canonical: '/' },
};

const FOODS = ['Dal tadka', 'Roti', 'Hyderabadi biryani', 'Masala dosa', 'Paneer tikka', 'Idli', 'Rajma chawal', 'Poha', 'Chole', 'Upma', 'Chai', 'Ragi sankati'];
const MACROS = ['Calories', 'Protein', 'Carbs', 'Fat', 'Weight trend', 'Steps', 'Body fat', '3D goal body'];

const STICKERS = [
  { Icon: Soup, cls: 'st1' },
  { Icon: Coffee, cls: 'st2' },
  { Icon: Wheat, cls: 'st3' },
  { Icon: Flame, cls: 'st4' },
  { Icon: CookingPot, cls: 'st5' },
  { Icon: Leaf, cls: 'st6' },
];

async function hasSessionCookie() {
  const store = await cookies();
  return store.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
}

function Wordmark({ size = 'md' }) {
  return (
    <span className={`${styles.plate} ${styles[`plate_${size}`]}`}>
      <span className={styles.plateWord}>WAY</span>
    </span>
  );
}

function Marquee({ items, variant }) {
  const row = [...items, ...items];
  return (
    <div className={`${styles.ribbon} ${styles[variant]}`} aria-hidden="true">
      <div className={styles.ribbonTrack}>
        {row.map((t, i) => (
          <span key={i}>
            {t} <b>✦</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  if (await hasSessionCookie()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect('/home');
  }

  const app = LEGAL.APP_NAME;

  return (
    <div className={styles.page}>
      {/* ---------------------------------------------------------- nav */}
      <header className={styles.nav}>
        <Link href="/" aria-label={`${app} home`} className={styles.navBrand}>
          <Wordmark size="sm" />
          <span className={styles.navStudio}>Studio</span>
        </Link>
        <nav className={styles.navLinks} aria-label="Main">
          <a href="#features">Features</a>
          <a href="#google-health">Google Health</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login" className={styles.btnInk}>
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.stickers} aria-hidden="true">
            {STICKERS.map(({ Icon, cls }) => (
              <span key={cls} className={`${styles.sticker} ${styles[cls]}`}>
                <Icon size={26} strokeWidth={2} />
              </span>
            ))}
          </div>

          <div className={styles.heroCopy}>
            <p className={`${styles.pill} ${styles.in}`} style={{ '--d': '0ms' }}>
              <Sparkles size={14} /> Diet &amp; physique tracking for Indian food
            </p>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span className={styles.in} style={{ '--d': '80ms' }}>
                Know what you <span className={styles.scribble}>eat.</span>
              </span>
              <span className={styles.in} style={{ '--d': '180ms' }}>
                See where you&apos;re <span className={styles.highlight}>heading.</span>
              </span>
            </h1>
            <p className={`${styles.heroText} ${styles.in}`} style={{ '--d': '280ms' }}>
              {app} is a free web app that helps you track the calories and macros (protein, carbohydrates and fat)
              of the Indian food you actually eat, log your weight, and follow your progress toward a goal such as
              losing weight, maintaining, or building muscle. You can optionally connect Google Health to bring in
              your steps, distance, calories burned, floors, heart rate, blood oxygen, VO₂ max, glucose and (optionally) sleep, and to send your logged meals and weight to the Google
              Health app.
            </p>
            <div className={`${styles.ctaRow} ${styles.in}`} style={{ '--d': '380ms' }}>
              <Link href="/login" className={styles.btnPop}>
                Get started, it&apos;s free <ArrowRight size={18} />
              </Link>
              <Link href="/privacy" className={styles.linkUnder}>
                Read our Privacy Policy
              </Link>
            </div>
          </div>

          <div className={`${styles.heroVisual} ${styles.in}`} style={{ '--d': '220ms' }}>
            <BodyShowcase />
          </div>
        </section>

        <Marquee items={FOODS} variant="ribbonTurmeric" />
        <Marquee items={MACROS} variant="ribbonInk" />

        {/* ---------------------------------------------------------- features */}
        <section id="features" className={styles.section} aria-labelledby="features-title">
          <h2 id="features-title" className={`${styles.h2} ${styles.reveal}`}>
            What <Wordmark size="xs" /> does
          </h2>

          <div className={styles.bento}>
            <article className={`${styles.card} ${styles.cardTurmeric} ${styles.reveal}`}>
              <div className={styles.cardIcon}>
                <Utensils size={20} />
              </div>
              <h3>Track Indian food, your way</h3>
              <p>
                Log meals from a food database built around Indian dishes, or build your own recipes. See calories,
                protein, carbs and fat for every meal and for the whole day.
              </p>
              <div className={styles.plateViz} aria-hidden="true">
                <div className={styles.donut}>
                  <span>
                    1,642
                    <small>kcal today</small>
                  </span>
                </div>
                <ul className={styles.legend}>
                  <li><i style={{ background: '#10b981' }} /> Protein 112g</li>
                  <li><i style={{ background: '#3b82f6' }} /> Carbs 186g</li>
                  <li><i style={{ background: '#8b5cf6' }} /> Fat 49g</li>
                </ul>
              </div>
            </article>

            <article className={`${styles.card} ${styles.cardSky} ${styles.reveal}`}>
              <div className={styles.cardIcon}>
                <Scale size={20} />
              </div>
              <h3>Weight and body progress</h3>
              <p>
                Record your weight over time, set a target, and see your trend. Add body measurements to preview your
                physique projection in 3D.
              </p>
              <svg className={styles.spark} viewBox="0 0 300 90" aria-hidden="true">
                <path className={styles.sparkArea} d="M0,22 C40,18 55,40 90,36 S150,48 180,52 S240,66 300,70 L300,90 L0,90 Z" />
                <path className={styles.sparkLine} d="M0,22 C40,18 55,40 90,36 S150,48 180,52 S240,66 300,70" />
                <circle className={styles.sparkDot} cx="300" cy="70" r="6" />
              </svg>
              <p className={styles.bigStat}>
                −3.4 <small>kg in 8 weeks</small>
              </p>
            </article>

            <article className={`${styles.card} ${styles.cardPink} ${styles.reveal}`}>
              <div className={styles.cardIcon}>
                <Footprints size={20} />
              </div>
              <h3>Activity at a glance</h3>
              <p>
                Optionally connect Google Health to see your daily steps, distance and calories burned next to what you
                eat.
              </p>
              <p className={styles.counter} aria-hidden="true">
                <span className={styles.count} />
                <small>steps today</small>
              </p>
            </article>

            <article className={`${styles.card} ${styles.cardLeaf} ${styles.reveal}`}>
              <div className={styles.cardIcon}>
                <Target size={20} />
              </div>
              <h3>Targets that fit you</h3>
              <p>
                Daily calorie and macro targets are calculated from your height, weight, age, activity level and goal,
                and you can set your own.
              </p>
              <div className={styles.bars} aria-hidden="true">
                {[
                  ['Protein', 0.86, '#10b981'],
                  ['Carbs', 0.72, '#3b82f6'],
                  ['Fat', 0.58, '#8b5cf6'],
                ].map(([label, f, c]) => (
                  <div key={label} className={styles.bar}>
                    <span>{label}</span>
                    <i style={{ '--f': f, background: c }} />
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        {/* ---------------------------------------------------------- how it works */}
        <section className={styles.section} aria-labelledby="how-title">
          <h2 id="how-title" className={`${styles.h2} ${styles.reveal}`}>
            Three steps. <span className={styles.highlight}>Zero guesswork.</span>
          </h2>
          <ol className={styles.steps}>
            {[
              ['Tell us about you', 'Height, weight, age, activity and goal. We work out your calories and macros.'],
              ['Log what you eat', 'Search Indian and everyday foods per 100 g, or repeat yesterday in one tap.'],
              ['Watch your body change', 'Your weight trend and your 3D goal body update as you go.'],
            ].map(([t, d], i) => (
              <li key={t} className={`${styles.step} ${styles.reveal}`}>
                <span className={styles.stepNum}>{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------- Google Health (verification content) */}
        <section id="google-health" className={styles.section} aria-labelledby="google-health-title">
          <div className={`${styles.ghCard} ${styles.reveal}`}>
            <h2 id="google-health-title" className={styles.ghTitle}>
              <ShieldCheck size={24} /> How {app} uses Google Health
            </h2>
            <p>
              Connecting Google Health is optional and always your choice. If you connect it, {app} asks for permission
              to:
            </p>
            <ul>
              <li>
                <strong>Read your activity</strong> (steps, distance and calories burned) to show on your dashboard.
              </li>
              <li>
                <strong>Read your heart and vitals</strong> (resting heart rate and the day&apos;s low and high, overnight
                blood oxygen, VO₂ max and blood glucose) to show on the dashboard tiles you choose. These are not stored by {app}.
              </li>
              <li>
                <strong>Optionally, read your sleep and irregular heart rhythm notifications</strong>, only if you add the Sleep
                tile or turn on irregular rhythm alerts. Not stored by {app}; an irregular rhythm alert is not a diagnosis.
              </li>
              <li>
                <strong>Write nutrition data</strong> (calories, protein, carbohydrates and fat) for meals you log in{' '}
                {app}, so they appear in the Google Health app.
              </li>
              <li>
                <strong>Write your weight</strong> so the weight you log appears in the Google Health app.
              </li>
            </ul>
            <p>
              You can disconnect at any time from Settings. We do not sell your data or use it for advertising.{' '}
              {app}&apos;s use and transfer to any other app of information received from Google APIs will adhere to
              the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Details are in our <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------- final CTA */}
        <section className={styles.final} aria-labelledby="final-title">
          <h2 id="final-title" className={`${styles.finalTitle} ${styles.reveal}`}>
            Diet your <Wordmark size="lg" />
          </h2>
          <div className={styles.reveal}>
            <Link href="/login" className={styles.btnPop}>
              Start free <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>
          &copy; {new Date().getFullYear()} {app}
        </span>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <a href={`mailto:${LEGAL.CONTACT_EMAIL}`}>{LEGAL.CONTACT_EMAIL}</a>
        </nav>
      </footer>
    </div>
  );
}
