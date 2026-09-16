'use client';

import { useState } from 'react';

export function FollowButton({
  type,
  id,
  following,
  label,
}: {
  type: 'company' | 'technology';
  id: string;
  following: boolean;
  label: string;
}) {
  const [on, setOn] = useState(following);
  const [error, setError] = useState('');
  async function toggle() {
    setError('');
    const next = !on;
    setOn(next);
    try {
      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, on: next }),
      });
      const result = await response.json();
      if (!response.ok) {
        setOn(!next);
        throw new Error(result.error || 'Could not update.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.');
    }
  }
  return (
    <span className="follow-wrap">
      <button
        type="button"
        className={on ? 'follow-btn is-on' : 'follow-btn'}
        onClick={() => void toggle()}
      >
        {on ? `Following ${label}` : `Follow ${label}`}
      </button>
      {error && <span className="follow-error">{error}</span>}
    </span>
  );
}
