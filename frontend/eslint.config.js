import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Berkas konteks menempatkan provider bersama hook pembacanya (`useAuth`,
    // `useProjects`, dst.) — pola baku React dan dipakai seluruh layar. Nama hook
    // tersebut didaftarkan di sini supaya react-refresh tetap menjaga aturan untuk
    // ekspor lain (konstanta dan fungsi bantu wajib pindah ke berkasnya sendiri),
    // tanpa memaksa hook konteks dipisah dari providernya.
    files: ['src/contexts/**/*.jsx'],
    rules: {
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true,
        allowExportNames: [
          'useActivities',
          'useActivityLog',
          'useAuth',
          'useChat',
          'useMasterData',
          'useNotifications',
          'useProjects',
        ],
      }],
    },
  },
])
