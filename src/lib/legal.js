// Single place to edit the details used by the Privacy Policy and Terms pages.
// >>> Set CONTACT_EMAIL to a real inbox you check before submitting for Google verification. <<<
export const LEGAL = {
  // Must match the app name on the Google OAuth consent screen exactly.
  APP_NAME: 'WAY Studio',
  SITE_URL: 'https://way-the-studio.vercel.app',
  // Google Search Console HTML-tag token (only the content="..." value).
  // Paste it here so verification does not depend on a Vercel env variable.
  // It is public in the page source anyway, so this is safe to commit.
  GOOGLE_SITE_VERIFICATION: 'Q2Z-HSqNb0z0PJYA05r3NFltquO351AmZ0pVVi22UmY',
  OPERATOR: 'Nischay (individual developer)',
  CONTACT_EMAIL: 'nischayreddy.t@gmail.com',
  EFFECTIVE_DATE: '3 October 2026',
  GOVERNING_LAW: 'India',
  JURISDICTION: 'Hyderabad, Telangana',
};

// Bump when the Terms or Privacy Policy change in a way users must re-accept.
export const TERMS_VERSION = '2026-10-03';