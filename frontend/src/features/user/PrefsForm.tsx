import { LANGS, type Lang } from '../../lib/i18n';
import { usePrefsStore, useT, type Theme } from '../../store/prefsStore';
import styles from './Settings.module.css';

// 언어 이름은 그 언어로 적어 어떤 화면 언어에서도 찾을 수 있게 한다
const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English', ja: '日本語' };
const THEMES: Theme[] = ['light', 'dark'];
const THEME_LABEL: Record<Theme, string> = { light: '라이트', dark: '다크' };

// FR-09·10, WF-07: 고르면 저장 버튼 없이 바로 적용·저장한다(PRD 4.5)
export function PrefsForm() {
  const t = useT();
  const { lang, theme, setLang, setTheme } = usePrefsStore();
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{t('화면')}</h2>
      <div className={styles.row}>
        <label htmlFor="settings-lang">{t('언어')}</label>
        <select
          id="settings-lang"
          className={styles.input}
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.row}>
        <label htmlFor="settings-theme">{t('테마')}</label>
        <select
          id="settings-theme"
          className={styles.input}
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
        >
          {THEMES.map((v) => (
            <option key={v} value={v}>
              {t(THEME_LABEL[v])}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
