import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// DL-11 의존 표: 디렉토리마다 import 금지 대상
const layer = (files, patterns, paths = []) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { paths, patterns }] },
});

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  { rules: { 'no-console': 'error' } }, // SO-06
  { files: ['src/lib/logger.ts'], rules: { 'no-console': 'off' } }, // SO-06: 개발 모드 전용 로그
  layer(['src/pages/**'], ['**/api/**']),
  // 다른 feature는 queries(훅)만 import한다
  layer(
    ['src/features/**'],
    ['**/pages/**', '../*/*', '!../*/queries', '!../*/queries.ts', '!../../**'],
  ),
  layer(['src/components/**'], ['**/features/**', '**/api/**', '**/pages/**']),
  layer(['src/api/**'], ['**/features/**', '**/components/**', '**/store/**', '**/pages/**']),
  layer(['src/store/**'], ['**/features/**', '**/api/**', '**/components/**']),
  layer(['src/lib/**'], ['../**', 'react', 'react-*']),
);
