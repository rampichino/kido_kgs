// @flow
// The KGS server stores a single locale string per account (e.g. "it_IT") and
// only accepts it in the LOGIN message — there is no DETAILS_CHANGE field for
// it. So the edit-profile country picker stashes the chosen locale here, and the
// login flow sends it on the next sign-in. The country (second half) drives the
// flag shown to every other client.

export const LOCALE_KEY = "kido_locale";
export const DEFAULT_LOCALE = "en_US";

// lang_COUNTRY pairs. The country half is what other clients turn into a flag;
// the language half is a sensible companion for that country.
export const LOCALE_OPTIONS: Array<{ value: string, label: string }> = [
  { value: "en_US", label: "United States" },
  { value: "en_GB", label: "United Kingdom" },
  { value: "en_AU", label: "Australia" },
  { value: "en_CA", label: "Canada" },
  { value: "fr_FR", label: "France" },
  { value: "de_DE", label: "Germany" },
  { value: "it_IT", label: "Italy" },
  { value: "es_ES", label: "Spain" },
  { value: "pt_PT", label: "Portugal" },
  { value: "pt_BR", label: "Brazil" },
  { value: "nl_NL", label: "Netherlands" },
  { value: "be_BE", label: "Belgium" },
  { value: "ch_CH", label: "Switzerland" },
  { value: "at_AT", label: "Austria" },
  { value: "se_SE", label: "Sweden" },
  { value: "no_NO", label: "Norway" },
  { value: "fi_FI", label: "Finland" },
  { value: "da_DK", label: "Denmark" },
  { value: "pl_PL", label: "Poland" },
  { value: "cs_CZ", label: "Czechia" },
  { value: "hu_HU", label: "Hungary" },
  { value: "ro_RO", label: "Romania" },
  { value: "ru_RU", label: "Russia" },
  { value: "uk_UA", label: "Ukraine" },
  { value: "tr_TR", label: "Turkey" },
  { value: "el_GR", label: "Greece" },
  { value: "ja_JP", label: "Japan" },
  { value: "ko_KR", label: "South Korea" },
  { value: "zh_CN", label: "China" },
  { value: "zh_TW", label: "Taiwan" },
  { value: "zh_HK", label: "Hong Kong" },
  { value: "vi_VN", label: "Vietnam" },
  { value: "th_TH", label: "Thailand" },
  { value: "id_ID", label: "Indonesia" },
  { value: "ms_MY", label: "Malaysia" },
  { value: "hi_IN", label: "India" },
  { value: "ar_SA", label: "Saudi Arabia" },
  { value: "he_IL", label: "Israel" },
  { value: "es_MX", label: "Mexico" },
  { value: "es_AR", label: "Argentina" },
  { value: "en_NZ", label: "New Zealand" },
  { value: "en_ZA", label: "South Africa" },
];

// The locale to send at the next login. Falls back to the default when the user
// has never picked one.
export function getStoredLocale(): string {
  try {
    let v = localStorage.getItem(LOCALE_KEY);
    return v || DEFAULT_LOCALE;
  } catch (e) {
    return DEFAULT_LOCALE;
  }
}

export function setStoredLocale(locale: string) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch (e) {
    // ignore — storage may be unavailable (private mode, etc.)
  }
}

// The 2-letter, lowercase country code for the flag-icons class (e.g.
// "it_IT" -> "it"). Returns null when the locale has no country half.
export function localeToCountryCode(locale: ?string): ?string {
  if (!locale) {
    return null;
  }
  let cc = locale.split(/[_-]/)[1];
  return cc && cc.length === 2 ? cc.toLowerCase() : null;
}
