/**
 * Theme storage key + the inline bootstrap script the root layout injects
 * (nonce'd) so `data-theme` is set before first paint. Plain module — no
 * 'use client' — because layout.tsx (a server component) reads these values.
 */
export const THEME_STORAGE_KEY = 'archive-theme'

/** Mirrors readSetting/apply in theme.tsx. */
export const THEME_BOOTSTRAP_SCRIPT =
  `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}` +
  `document.documentElement.dataset.theme=t}catch(e){}})()`
