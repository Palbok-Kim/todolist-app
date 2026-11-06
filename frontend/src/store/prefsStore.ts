import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translate, type Lang, type Vars } from '../lib/i18n';

export type Theme = 'light' | 'dark' | 'blue-black' | 'blue-white' | 'orange-white' | 'green-white';

interface S {
  lang: Lang;
  theme: Theme;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
}

// PRD 4.5: 처음은 브라우저 언어(지원 밖이면 한국어)와 OS 테마를 따른다
function initialLang(): Lang {
  const l = navigator.language.slice(0, 2);
  return l === 'en' || l === 'ja' ? l : 'ko';
}
const initialTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// DL-13: 서버에 없는 화면 설정이라 이 브라우저의 localStorage에만 둔다
export const usePrefsStore = create<S>()(
  persist(
    (set) => ({
      lang: initialLang(),
      theme: initialTheme(),
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'todolist-prefs', partialize: (s) => ({ lang: s.lang, theme: s.theme }) },
  ),
);

// CN-12: 한국어 원문을 고른 언어로 바꾼다
export function useT() {
  const lang = usePrefsStore((s) => s.lang);
  return useCallback((text: string, vars?: Vars) => translate(text, lang, vars), [lang]);
}
