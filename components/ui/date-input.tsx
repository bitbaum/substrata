'use client';

// The one place substrata takes its date input from. A date is picked, not
// typed: the value reads in words in the page's own styling while the real
// date input stays on top — see @bitbaum/whenkit. The stylesheet is imported
// here, once.
import '@bitbaum/whenkit/styles.css';

export { DateInput } from '@bitbaum/whenkit/react';
