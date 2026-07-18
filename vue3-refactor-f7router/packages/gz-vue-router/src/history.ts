const COUNTER_KEY = '__gzRouterSeqCounter__';
const BASE_KEY = '__gzRouterBaseSeq__';

function readSession(key: string): number {
  try {
    return Number(sessionStorage.getItem(key) || '0');
  } catch {
    return 0;
  }
}
function writeSession(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    /* 隐私模式等场景 sessionStorage 可能不可用，降级为纯内存计数，仅丢失跨刷新恢复能力 */
  }
}

/**
 * seq 分配器：单调递增的历史序号，必须跨刷新持久化（sessionStorage），
 * 否则每次 reload 计数器从 0 重新数起，深层页面刷新后会和更早的历史记录“撞号”。
 *
 * baseSeq 记录“这个 tab 会话里第一次出现的 seq”——只在 sessionStorage 里从未记录过
 * 计数器时才会被设置一次，代表这是这个标签页第一次加载本应用，往前不存在任何真实历史，
 * 用来判断 canGoBack。
 */
export function createSeqAllocator(enabled: boolean) {
  const counterExistedBeforeThisLoad = enabled ? sessionStorage.getItem(COUNTER_KEY) !== null : false;
  let counter = enabled ? readSession(COUNTER_KEY) : 0;

  function next() {
    counter += 1;
    if (enabled) writeSession(COUNTER_KEY, counter);
    return counter;
  }

  function readBaseSeq(fallback: number): number {
    return enabled ? readSession(BASE_KEY) || fallback : fallback;
  }

  function writeBaseSeqOnce(seq: number) {
    if (enabled && !counterExistedBeforeThisLoad) writeSession(BASE_KEY, seq);
  }

  return { counterExistedBeforeThisLoad, next, readBaseSeq, writeBaseSeqOnce };
}

export interface HistoryState {
  seq: number;
}

export function readExistingState(): HistoryState | null {
  const state = window.history.state as HistoryState | null;
  return state && typeof state.seq === 'number' ? state : null;
}

export function pushHistory(seq: number, url: string) {
  window.history.pushState({ seq }, '', url);
}
export function replaceHistory(seq: number, url: string) {
  window.history.replaceState({ seq }, '', url);
}
export function goBackInHistory() {
  window.history.back();
}
export function goInHistory(delta: number) {
  window.history.go(delta);
}
export function currentLocation() {
  return window.location.pathname + window.location.search;
}
