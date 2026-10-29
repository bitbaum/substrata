'use client';

import {
  AccountPanel,
  SignInForm,
  SignUpForm,
  type AuthClasses,
  type AuthLabels,
} from '@bitbaum/accountkit/auth/react';
import type { SignInMethods } from '@bitbaum/accountkit/auth';
import { authClient } from '@/lib/auth-client';

/**
 * The fleet's account screens (@bitbaum/accountkit/auth/react) in
 * Substrata's look. The logic and the words are the package's, the same in
 * every product.
 */
const CLASSES: Partial<AuthClasses> = {
  stack: 'flex flex-col gap-5',
  field: 'flex flex-col gap-2',
  label: 'text-sm font-semibold text-fg-primary',
  hint: 'text-sm leading-relaxed text-fg-secondary',
  input: 'research-input w-full',
  button: 'research-button justify-center',
  buttonQuiet: 'research-button-ghost justify-center',
  notice: 'desk-notice',
  error: 'text-sm text-status-negative',
  divider:
    'flex items-center gap-3 text-xs uppercase tracking-wide text-fg-tertiary before:h-px before:flex-1 before:bg-border-subtle after:h-px after:flex-1 after:bg-border-subtle',
  section: 'flex flex-col gap-4 border-t border-border-subtle pt-8',
  sectionTitle: 'text-lg font-semibold text-fg-primary',
  link: 'break-all text-accent underline-offset-4 hover:underline',
  check: 'flex min-h-11 items-center gap-3 text-sm text-fg-secondary',
};

const textLink = 'text-accent underline-offset-4 hover:underline';

export function SubstrataSignIn(props: {
  labels: AuthLabels;
  methods: SignInMethods;
  next: string;
  signUpHref: string;
  initialError: boolean;
}) {
  return (
    <SignInForm
      client={authClient}
      classes={CLASSES}
      labels={props.labels}
      methods={props.methods}
      next={props.next}
      signInPath="/sign-in"
      initialError={props.initialError}
      signUpLink={
        <a href={props.signUpHref} className={textLink}>
          {props.labels.createAccount}
        </a>
      }
    />
  );
}

export function SubstrataSignUp(props: {
  labels: AuthLabels;
  methods: SignInMethods;
  next: string;
  signInHref: string;
}) {
  return (
    <SignUpForm
      client={authClient}
      classes={CLASSES}
      labels={props.labels}
      methods={props.methods}
      next={props.next}
      signUpPath="/sign-up"
      signInLink={
        <a href={props.signInHref} className={textLink}>
          {props.labels.signIn}
        </a>
      }
    />
  );
}

export function SubstrataAccount(props: {
  labels: AuthLabels;
  methods: SignInMethods;
  user: {
    name: string;
    email: string | null;
    emailVerified: boolean;
    role: string;
    twoFactorEnabled: boolean;
  };
  linked: string[];
}) {
  return (
    <AccountPanel
      client={authClient}
      classes={CLASSES}
      accountPath="/account/settings"
      homePath="/"
      {...props}
    />
  );
}
