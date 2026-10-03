import LegalPage, { Section, UL, ContactLine } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms for using WAY Studio, the Indian-food diet and physique tracking app.',
};

export default function TermsPage() {
  const app = LEGAL.APP_NAME;
  return (
    <LegalPage title="Terms of Service" otherHref="/privacy" otherLabel="Privacy Policy">
      <Section title="1. Agreement">
        <p>
          By creating an account or using {app}, you agree to these Terms and to our Privacy Policy. If you do not agree,
          please do not use the app.
        </p>
      </Section>

      <Section title="2. The service and who can use it">
        <p>
          {app} helps you log meals, track nutrition and weight, view activity, and optionally sync with Google Health. You
          must be at least 18 years old and able to enter a binding agreement.
        </p>
      </Section>

      <Section title="3. Your account">
        <p>
          You are responsible for the activity on your account and for keeping your sign-in method secure. Give accurate
          information and tell us if you think your account has been misused.
        </p>
      </Section>

      <Section title="4. Not medical advice">
        <p>
          {app} provides general information and estimates, including calorie and macro targets, based on what you enter. It
          is not medical advice and does not diagnose, treat or prevent any condition. Talk to a doctor or registered
          dietitian before changing your diet or exercise, especially if you are pregnant, have a medical condition, or take
          medication. You use the app&apos;s suggestions at your own risk.
        </p>
      </Section>

      <Section title="5. Your content">
        <p>
          You keep ownership of the data you enter. You give us permission to store and process it only to run {app} for
          you, as described in the Privacy Policy.
        </p>
      </Section>

      <Section title="6. Google Health and other third-party services">
        <p>
          Connecting Google Health is optional and is also subject to Google&apos;s own terms and policies. Syncing depends
          on Google&apos;s services and the permissions you grant, so it may be delayed, incomplete or unavailable. We are not
          responsible for Google&apos;s services or for data held in your Google account.
        </p>
      </Section>

      <Section title="7. Acceptable use">
        <UL
          items={[
            'Do not break the law or misuse the app.',
            'Do not try to access other users\u2019 data, disrupt or overload the service, or probe it for weaknesses.',
            'Do not copy, resell or reverse engineer the app except where the law allows.',
            'Do not use automated tools to scrape or bulk-create accounts.',
          ]}
        />
      </Section>

      <Section title="8. Availability and changes">
        <p>
          We work to keep {app} running but do not promise uninterrupted or error-free service. We may change, pause or end
          features at any time, and we may update these Terms; we will ask you to accept significant changes.
        </p>
      </Section>

      <Section title="9. Ending your use">
        <p>
          You can stop using {app} or delete your account in Settings at any time. We may suspend or end access if you break
          these Terms or put the service or other users at risk.
        </p>
      </Section>

      <Section title="10. Disclaimers">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the fullest extent the law allows,
          we give no warranties about accuracy, food data, nutrition estimates, fitness for a particular purpose, or
          uninterrupted operation.
        </p>
      </Section>

      <Section title="11. Limitation of liability">
        <p>
          To the fullest extent the law allows, {app} and its operator are not liable for indirect, incidental or consequential
          losses, or for loss of data, arising from your use of the app. Nothing in these Terms limits liability that cannot be
          limited by law.
        </p>
      </Section>

      <Section title="12. Governing law">
        <p>
          These Terms are governed by the laws of {LEGAL.GOVERNING_LAW}, and the courts at {LEGAL.JURISDICTION} have
          jurisdiction over disputes, unless the law gives you the right to bring a claim elsewhere.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Questions about these Terms: <ContactLine />.
        </p>
      </Section>
    </LegalPage>
  );
}