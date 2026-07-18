import { ref } from 'vue';

export interface HookLogEntry {
  time: string;
  label: string;
  detail: string;
}

/** 给下面几个嵌套测试组件共用的小工具：记一条日志，最多保留最近 max 条（新的在最前面）。 */
export function useHookLog(max = 6) {
  const entries = ref<HookLogEntry[]>([]);
  function log(label: string, detail: string) {
    entries.value = [{ time: new Date().toLocaleTimeString(), label, detail }, ...entries.value].slice(0, max);
  }
  return { entries, log };
}
