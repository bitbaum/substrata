'use client';

import { useEffect, useState } from 'react';

/** Whether the shared assistant is up, and which free models it offers. */
export function useAssistantStatus() {
  const [ai, setAi] = useState<'unknown' | 'up' | 'down'>('unknown');
  const [models, setModels] = useState<{ id: string; label: string }[]>([
    { id: 'auto', label: 'Auto' },
  ]);
  const [model, setModel] = useState('auto');

  useEffect(() => {
    void fetch('/api/health')
      .then((r) => r.json())
      .then((j) => setAi(String(j.ai ?? '').startsWith('configured') ? 'up' : 'down'))
      .catch(() => setAi('down'));
    void fetch('/api/chat')
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.models) && j.models.length) setModels(j.models);
      })
      .catch(() => undefined);
  }, []);

  return { ai, models, model, setModel };
}
