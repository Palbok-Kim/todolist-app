import { en } from './en';
import { ja } from './ja';

// FR-09, PRD 4.5: 한국어가 원문이고 원문 문장을 그대로 키로 쓴다(CN-12)
export type Lang = 'ko' | 'en' | 'ja';
export const LANGS: readonly Lang[] = ['ko', 'en', 'ja'];
export type Vars = Record<string, string | number>;

const DICTS: Record<Exclude<Lang, 'ko'>, Record<string, string>> = { en, ja };

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

// 서버·검증 메시지는 값이 채워진 채로 오므로 `{n}` 자리표시 키를 정규식으로 맞춰 값을 되찾는다
const PATTERNS = Object.keys(en)
  .filter((k) => k.includes('{'))
  .map((key) => {
    const names: string[] = [];
    const src = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n: string) => {
      names.push(n);
      return '(.+?)';
    });
    return { key, names, re: new RegExp(`^${src}$`) };
  });

export function translate(text: string, lang: Lang, vars?: Vars): string {
  if (lang === 'ko') return fill(text, vars);
  // 저장소에 지원 밖 언어가 남아 있어도 화면이 깨지지 않게 원문으로 보인다
  const dict = DICTS[lang as keyof typeof DICTS] as Record<string, string> | undefined;
  if (!dict) return fill(text, vars);
  if (dict[text] !== undefined) return fill(dict[text], vars);
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (m && dict[p.key] !== undefined) {
      return fill(dict[p.key], Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]])));
    }
  }
  // 사전에 없는 서버 메시지는 원문을 보인다(PRD 4.5)
  return fill(text, vars);
}
