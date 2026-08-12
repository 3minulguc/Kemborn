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
    rules: {
      // Yakalanan ama kullanılmayan hata değişkeni yaygın ve zararsız
      // (catch (err) { toast.error("..."); }) — sunucu tarafında da aynı
      // istisna var (kemborn-server/eslint.config.js).
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
])
