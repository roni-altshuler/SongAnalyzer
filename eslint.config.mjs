// ESLint v9 flat config.
//
// Bridges the v1 `.eslintrc.json` (extends "next/core-web-vitals") to the new
// flat format. `eslint-config-next/core-web-vitals` already exports a flat
// config array in v16, so we spread it and apply local relaxations.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextCoreWebVitals,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'supabase/seed.sql',
    ],
  },
  {
    rules: {
      // React 19's strict `set-state-in-effect` rule fires on the
      // SSR-mount idiom (setMounted(true) to avoid hydration mismatch) and
      // on intentional one-shot reads from localStorage / matchMedia. We
      // keep it as a warning to surface unintended cascades but not gate CI.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
