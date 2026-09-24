import React from 'react';

import type { Segment } from '@/lib/search-types';

/** Text with the matched words marked. Works in server and client components alike. */
export function Highlight({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.hit ? (
          <mark key={i} className="search-mark">
            {s.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        ),
      )}
    </>
  );
}
