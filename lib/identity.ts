/** Called only after Auth.js validates OrangeCat's signed OIDC response. */
export function hasAuthenticatedSubject(profile: { sub?: unknown } | undefined | null) {
  return typeof profile?.sub === 'string' && profile.sub.trim().length > 0;
}
