import js from '@eslint/js';

// DL-01 의존 표: 디렉토리마다 import 금지 대상
const layer = (files, patterns, paths = []) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { paths, patterns }] },
});

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
      },
    },
    rules: { 'no-console': 'error' }, // SO-06
  },
  { files: ['src/lib/logger.js'], rules: { 'no-console': 'off' } },
  layer(['src/routes/**'], ['**/db/**', '**/validation/**', '**/lib/*', '!**/lib/cookies.js']),
  layer(['src/services/**'], ['**/routes/**', '**/middleware/**', './*.service.js'], ['express']),
  layer(['src/validation/**'], ['**/db/**', '**/services/**'], ['express']),
  layer(
    ['src/db/**'],
    ['**/services/**', '**/routes/**', '**/middleware/**', '**/errors.js'],
    ['express'],
  ),
  layer(['src/middleware/**'], ['**/db/**', '**/services/**']),
  layer(['src/lib/**'], ['**/routes/**', '**/services/**', '**/db/**', '**/middleware/**']),
  layer(['scripts/**'], ['**/routes/**', '**/services/**', '**/middleware/**']),
];
