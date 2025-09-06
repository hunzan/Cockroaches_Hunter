// js/core/platform.js
export const isElectron = !!(globalThis?.process?.versions?.electron);
export const hasTouch = ('ontouchstart' in globalThis) || (navigator.maxTouchPoints > 0);
export const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
export const isMobile = hasTouch || isMobileUA;

export const isMac = /Macintosh|Mac OS X/i.test(navigator.userAgent);
export const isWindows = /Windows/i.test(navigator.userAgent);

// 功能偵測
export const canFullscreen = !!(document.documentElement.requestFullscreen);
export const hasVibration = !!(navigator.vibrate);
export const hasWebAudio = !!(globalThis.AudioContext || globalThis.webkitAudioContext);

// 小工具：等到 DOM 準備好
export function onReady(fn){
  if (document.readyState === 'complete' || document.readyState === 'interactive') { fn(); }
  else document.addEventListener('DOMContentLoaded', fn, { once: true });
}
