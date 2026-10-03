import LegalPage, { Section, UL, ContactLine } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Privacy Policy',
  description:
    'How WAY Studio collects, uses, shares, stores and deletes your data, including Google user data and Google Health data.',
};

const SCOPES = [
  {
    scope: 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
    what: 'Read-only access to your daily steps, distance and calories burned.',
    why: 'To show these figures on your dashboard and Activity page next to your food intake, and to compare them with goals you set.',
  },
  {
    scope: 'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly',
    what: 'Write-only access to add nutrition entries (calories, protein, carbohydrates, fat) to your Google Health account.',
    why: 'To send meals you log in WAY Studio to the Google Health app when you tap Sync food or have automatic sync turned on. We cannot read back your existing nutrition data with this permission.',
  },
  {
    scope: 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.writeonly',
    what: 'Write-only access to add body weight entries to your Google Health account.',
    why: 'To send the weight you log in WAY Studio to the Google Health app when you tap Sync weight or have automatic sync turned on.',
  },
];

export default function PrivacyPage() {
  const app = LEGAL.APP_NAME;
  const A = ({ href, children, ext }) => (
    <a
      className="font-medium text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
      href={href}
      {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );

  return (
    <LegalPage title="Privacy Policy" otherHref="/terms" otherLabel="Terms of Service">
      <Section title="1. About this policy">
        <p>
          {app} (&ldquo;we&rdquo;, &ldquo;us&rdquo;), available at <A href={LEGAL.SITE_URL}>{LEGAL.SITE_URL}</A>, is a
          web app for tracking the calories and macronutrients of Indian food, logging body weight, and following your
          progress toward a diet goal. It is operated by {LEGAL.OPERATOR}. This Privacy Policy explains what personal
          information we collect, why we collect it, how we use, share, store and protect it, how long we keep it, and how you
          can delete it. It applies to the {app} website and web app. Contact: <ContactLine />.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <p>We collect only what the app needs to work.</p>
        <p className="font-medium text-slate-900 dark:text-white">Information you give us</p>
        <UL
          items={[
            'Account information: your email address. If you sign in with Google, we also receive your name and basic profile details from Google. If you sign in with an email code, we receive the email address you enter.',
            'Profile and goals: display name, height, weight, age, sex, activity level, diet goal (lose, maintain or gain weight), calorie and macro targets, optional daily step, distance and calorie-burn goals, and optional body measurements.',
            'Food and recipe logs: foods and meals you log (item, quantity, meal type, date and time) and custom recipes or dishes you create.',
            'Weight logs: your weight entries and dates, and an optional target weight and target date.',
          ]}
        />
        <p className="font-medium text-slate-900 dark:text-white">Information from Google, only if you connect Google Health</p>
        <UL
          items={[
            'Your daily steps, distance and calories burned (read from Google Health).',
            'OAuth access and refresh tokens that Google issues so the connection keeps working (see section 4).',
          ]}
        />
        <p className="font-medium text-slate-900 dark:text-white">Information collected automatically</p>
        <UL
          items={[
            'Session cookies set by our authentication provider to keep you signed in.',
            'Preferences kept in your browser\u2019s local storage, such as light or dark theme and whether you accepted our Terms.',
            'Standard server logs (for example IP address and request time) kept by our hosting provider for security and reliability.',
          ]}
        />
        <p>
          We do not ask for payment details, your contacts, your precise location, photos or files, and we do not use
          advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section title="3. How we use your information">
        <UL
          items={[
            'To create and secure your account and sign you in.',
            'To calculate your daily calorie and macro targets and show your nutrition, weight trend, body progress and activity.',
            'To send your logged meals and weight to Google Health, and to show your Google Health activity, when you connect it and choose to use those features.',
            'To fix problems, prevent abuse and keep the service reliable.',
            'To answer your questions and requests, and to meet legal obligations.',
          ]}
        />
        <p>
          We do not sell your personal information, we do not use it for advertising, and we do not build advertising
          profiles from it.
        </p>
      </Section>

      <Section title="4. Google user data and Google Health">
        <p>
          Connecting Google Health is optional. If you connect it, {app} asks Google for the following permissions (OAuth
          scopes), and only these:
        </p>
        <div className="space-y-3">
          {SCOPES.map((s) => (
            <div
              key={s.scope}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <p className="break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">{s.scope}</p>
              <p className="mt-1.5">
                <strong className="text-slate-900 dark:text-white">What it allows:</strong> {s.what}
              </p>
              <p className="mt-1">
                <strong className="text-slate-900 dark:text-white">How we use it:</strong> {s.why}
              </p>
            </div>
          ))}
        </div>
        <p className="font-medium text-slate-900 dark:text-white">How Google user data is handled</p>
        <UL
          items={[
            'Activity data (steps, distance, calories burned) is requested from Google when you open the app and is shown to you. It is used only to display your dashboard and activity pages.',
            'Nutrition and weight data is sent to Google only when you tap a sync button, or when automatic sync is on. Each sync sends the values you already logged in the app.',
            'We store the OAuth tokens Google gives us in our database, linked to your account, and use them only to perform the actions above on your behalf. We never store your Google password.',
            'We do not sell Google user data and do not transfer or share it with third parties, except to our service providers as needed to operate the app (section 5), to comply with law, or with your consent.',
            'We do not use Google user data for advertising, including retargeting or interest-based advertising.',
            'We do not use Google user data to develop, improve or train generalized artificial intelligence or machine learning models.',
            'No person at WAY Studio reads your Google user data unless you ask us to, it is necessary for security or to investigate abuse, or the law requires it.',
          ]}
        />
        <p>
          {app}&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
          <A ext href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </A>
          , including the Limited Use requirements.
        </p>
        <p>
          <strong className="text-slate-900 dark:text-white">Disconnecting.</strong> You can disconnect Google Health at any
          time using Disconnect in Settings; this deletes our stored tokens and revokes our access at Google. You can also
          remove {app} at any time from your Google Account&apos;s third-party access page at{' '}
          <A ext href="https://myaccount.google.com/permissions">
            myaccount.google.com/permissions
          </A>
          . Entries already written into your Google Health account remain there until you delete them in Google Health.
        </p>
      </Section>

      <Section title="5. Who we share information with">
        <p>
          We share information only with service providers that process it on our behalf to run {app}, under their own
          privacy and security commitments:
        </p>
        <UL
          items={[
            'Supabase: database storage and user authentication.',
            'Google: Google Sign-In (if you choose it) and the Google Health API (if you connect it).',
            'Our email delivery provider: to send sign-in codes to your email address.',
            'Our web hosting provider: to serve the website and apps.',
          ]}
        />
        <p>
          We may also disclose information if required by law or to protect the rights, safety and security of users or the
          service. If {app} is ever transferred to another operator, we will make sure your information stays protected by an
          equivalent policy and tell you first. We do not sell or rent personal information.
        </p>
      </Section>

      <Section title="6. How we store and protect your information">
        <UL
          items={[
            'Data is sent over encrypted HTTPS connections.',
            'Records are protected by access controls so each signed-in user can reach only their own data.',
            'Google OAuth tokens are kept server-side in our database and are never shown in the app or shared with other users.',
            'We limit the information we collect to what the features need.',
          ]}
        />
        <p>
          No online service can promise perfect security. Please keep your devices and sign-in methods secure and contact us
          if you suspect misuse of your account.
        </p>
      </Section>

      <Section title="7. How long we keep it, and how to delete it">
        <p>
          We keep your information for as long as you have an account. You are in control of deletion:
        </p>
        <UL
          items={[
            'Delete account (Settings → Delete account) permanently erases your profile, food logs and weight logs, revokes our access to Google Health, and deletes the stored Google tokens.',
            'Disconnect (Settings → Connected Apps) removes Google Health access and our stored Google tokens without deleting your account.',
            'To also remove your sign-in record held by our authentication provider, or to request deletion of anything else, email us at the address below and we will act on it within a reasonable time, normally within 30 days.',
          ]}
        />
        <p>
          Data may remain in encrypted backups for a short period before being overwritten. Data previously written to your
          Google Health account is controlled by you in Google Health.
        </p>
      </Section>

      <Section title="8. Your rights and choices">
        <p>
          You can view and edit your profile and logs in the app. You can also ask us to give you a copy of, correct or delete
          your personal information, or withdraw consent to our processing, by emailing <ContactLine />. We handle requests in
          line with applicable law, including India&apos;s Digital Personal Data Protection Act, 2023. If you have a grievance
          about how we handle your data, contact us first and we will respond promptly.
        </p>
      </Section>

      <Section title="9. Cookies and local storage">
        <p>
          We use essential cookies from our authentication provider to keep you signed in, and browser local storage for
          preferences such as theme and Terms acceptance. These are needed for the app to work. We do not use them for
          advertising. You can clear them in your browser settings, but you may then be signed out.
        </p>
      </Section>

      <Section title="10. Children">
        <p>{app} is not intended for anyone under 18. We do not knowingly collect information from children. If you believe a child has given us information, contact us and we will delete it.</p>
      </Section>

      <Section title="11. Where information is processed">
        <p>
          Our service providers may store and process information on servers outside India. By using {app} you understand
          that your information may be transferred to and handled in those locations.
        </p>
      </Section>

      <Section title="12. Changes to this policy">
        <p>
          We may update this policy as the app changes. The effective date at the top shows the latest version, and we will
          ask you to review and accept significant changes.
        </p>
      </Section>

      <Section title="13. Contact us">
        <p>
          {LEGAL.OPERATOR}, {app}. Email: <ContactLine />. Website: <A href={LEGAL.SITE_URL}>{LEGAL.SITE_URL}</A>.
        </p>
      </Section>
    </LegalPage>
  );
}