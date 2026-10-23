import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import * as espree from 'espree';

// ESLint 10 flat config, matching the fleet's Next 16 apps (same two
// workarounds as evig's config, until upstream ships ESLint 10 releases):
//
// 1. eslint-config-next ships `settings.react.version: 'detect'`. Detection
//    calls eslint-plugin-react's resolveBasedir(context), which still calls
//    the removed `context.getFilename()` — eslint-plugin-react has no
//    ESLint 10 release yet (peerDependencies cap at ^9.7 as of 7.37.5), so
//    'detect' throws on every file. Pin the version from package.json instead.
// 2. Plain .js/.mjs files are parsed via Next's own vendored babel parser,
//    whose scope manager predates ESLint 10's Language API and crashes the
//    run. None of these files use JSX, so plain espree covers them.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { react: { version: '19.2.4' } },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { parser: espree },
  },
  // packages/* lint themselves with their own config (they are standalone).
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'packages/**']),
]);

export default eslintConfig;
