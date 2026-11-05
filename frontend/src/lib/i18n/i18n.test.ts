import { describe, expect, test } from 'vitest';
import { en } from './en';
import { ja } from './ja';
import { translate } from './index';

describe('translate', () => {
  test('ko는 원문을 그대로 돌려준다', () => {
    expect(translate('저장', 'ko')).toBe('저장');
  });
  test('사전에 있으면 번역한다', () => {
    expect(translate('저장', 'en')).toBe('Save');
    expect(translate('저장', 'ja')).toBe('保存');
  });
  test('자리표시를 채운다', () => {
    expect(translate('+{n}개 더', 'en', { n: 2 })).toBe('+2 more');
    expect(translate('+{n}개 더', 'ko', { n: 2 })).toBe('+2개 더');
  });
  test('값이 채워진 서버 메시지도 자리표시 키로 번역한다', () => {
    expect(translate('30자 이하로 입력해 주세요.', 'en')).toBe('Enter 30 characters or fewer.');
    expect(translate('기간은 62일 이하여야 합니다.', 'ja')).toBe('期間は62日以内にしてください。');
  });
  test('없는 키는 원문을 돌려준다', () => {
    expect(translate('사전에 없는 문장', 'en')).toBe('사전에 없는 문장');
  });
});

test('en과 ja의 키가 같다', () => {
  expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
});

// --- 완료 조건: 소스의 한국어 문자열이 모두 사전에 있다(CN-12, TQ-06) ---
const HANGUL = /[가-힣]/;
// 문자열 리터럴 또는 주석 하나를 앞에서부터 찾는다(주석 안의 따옴표와 문자열 안의 //를 구분)
const TOKEN =
  /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
// 번역하지 않는 언어 이름(features/user/PrefsForm의 LANG_NAMES)
const UNTRANSLATED = new Set(['한국어']);

function scan(code: string) {
  const literals: string[] = [];
  const rest = code.replace(TOKEN, (_m, str?: string) => {
    if (str === undefined) return ' '; // 주석
    const body = str.slice(1, -1).replace(/\$\{([^}]*)\}/g, '{$1}');
    if (HANGUL.test(body)) literals.push(body);
    return ' ';
  });
  return { literals, rest };
}

// @types/node 없이 Vite의 glob으로 소스 원문을 읽는다
const FRONT = Object.entries(
  import.meta.glob<string>('../../**/*.{ts,tsx}', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
).filter(([f]) => !/\.test\.tsx?$/.test(f) && !/^\.\/(en|ja)\.ts$/.test(f));

// 백엔드 config.js(기동 실패 메시지)와 lib/password.js(내부 Error)는 사용자에게 안 보인다
const BACK = Object.entries(
  import.meta.glob<string>('../../../../backend/src/**/*.js', {
    eager: true,
    query: '?raw',
    import: 'default',
  }),
).filter(([f]) => !/\.test\.js$|config\.js$|password\.js$/.test(f));

describe('사전 완결성', () => {
  const need = new Set<string>();
  const leftover: string[] = [];
  for (const [f, src] of FRONT) {
    const { literals, rest } = scan(src);
    literals.filter((l) => !UNTRANSLATED.has(l)).forEach((l) => need.add(l));
    if (HANGUL.test(rest)) leftover.push(f);
  }
  for (const [, src] of BACK) {
    // 로거 메시지는 사용자에게 안 보이므로 그 줄은 뺀다
    const code = src
      .split('\n')
      .filter((l) => !l.includes('logger.'))
      .join('\n');
    scan(code).literals.forEach((l) => need.add(l));
  }

  test('소스를 찾았다', () => {
    expect(FRONT.length).toBeGreaterThan(20);
    expect(BACK.length).toBeGreaterThan(5);
  });
  test.each([
    ['en', en],
    ['ja', ja],
  ])('모든 한국어 문자열이 %s 사전에 있다', (_n, dict) => {
    expect([...need].filter((k) => !(k in dict))).toEqual([]);
  });
  test('JSX 텍스트에 문자열 리터럴 밖의 한국어가 없다', () => {
    expect(leftover).toEqual([]);
  });
});
