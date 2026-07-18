import { ref, reactive, computed, shallowReactive, type App } from 'vue';
import type {
  AfterHook,
  Direction,
  GZRouterOptions,
  MatchedRoute,
  NavigationGuard,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteMeta,
  RouteRecordRaw,
  StackEntry,
} from './types';
import { matchByUrl, resolveUrl } from './matcher';
import { runGuardSequence } from './guards';
import {
  createSeqAllocator,
  currentLocation,
  goBackInHistory,
  goInHistory,
  pushHistory,
  readExistingState,
  replaceHistory,
} from './history';
import { ROUTER_KEY, ROUTE_KEY } from './injection-keys';

export interface GZRouter {
  /** 响应式的“当前路由”，字段访问方式对齐 vue-router（无需 .value） */
  currentRoute: RouteLocationNormalized;
  push(to: RouteLocationRaw): void;
  replace(to: RouteLocationRaw): void;
  /** @param fallbackUrl 既没有应用内上一页、也没有可追溯的浏览器历史时的兜底目标 */
  back(fallbackUrl?: string): void;
  forward(): void;
  go(delta: number): void;
  beforeEach(guard: NavigationGuard): () => void;
  afterEach(hook: AfterHook): () => void;
  install(app: App): void;

  // 以下是 gz-vue-router 特有、驱动 GZRouterView 过渡动画/GZModalView 弹层栈的状态，非 vue-router 概念
  stack: StackEntry[];
  /** 弹层栈：可以叠加多层（modalA push modalB 时两个都在），由 <GZModalView> 消费渲染 */
  modalStack: StackEntry[];
  direction: { value: Direction };
  canGoBack: { value: boolean };

  /** @internal 供 onBeforeRouteLeave/onBeforeRouteUpdate 使用 */
  _registerLeaveGuard(entryId: number, guard: NavigationGuard): void;
  _unregisterLeaveGuard(entryId: number, guard: NavigationGuard): void;
  _registerUpdateGuard(entryId: number, guard: NavigationGuard): void;
  _unregisterUpdateGuard(entryId: number, guard: NavigationGuard): void;
}

function toLocation(matched: MatchedRoute): RouteLocationNormalized {
  // meta 按祖先 -> 叶的顺序合并（浅合并，叶子的字段覆盖祖先同名字段），
  // 这样父路由（比如布局）上的 meta 能被子孙路由继承，同时子孙可以覆盖
  const meta: RouteMeta = {};
  matched.chain.forEach((record) => Object.assign(meta, record.meta));
  return {
    path: matched.path,
    fullPath: matched.url,
    name: matched.route.name,
    params: matched.params,
    query: Object.fromEntries(new URLSearchParams(matched.url.split('?')[1] ?? '')),
    meta,
  };
}

function normalizeGuardList(g: NavigationGuard | NavigationGuard[] | undefined): NavigationGuard[] {
  if (!g) return [];
  return Array.isArray(g) ? g : [g];
}

/**
 * 路由独享守卫（beforeEnter）按祖先 -> 子孙的顺序级联收集：父路由的 beforeEnter 先跑，
 * 子孙路由自己的 beforeEnter 后跑。未嵌套的普通路由 chain 长度为 1，行为和之前完全一样。
 */
function collectChainGuards(matched: MatchedRoute): NavigationGuard[] {
  return matched.chain.flatMap((record) => normalizeGuardList(record.beforeEnter));
}

const UNKNOWN_LOCATION: RouteLocationNormalized = {
  path: '',
  fullPath: '',
  name: '',
  params: {},
  query: {},
  meta: {},
};

/**
 * 创建一个 gz-vue-router 路由实例。API 形状对齐 vue-router（push/replace/back/go/forward、
 * beforeEach/afterEach、currentRoute、install 插件安装），额外暴露 stack/modalStack/direction
 * 这几个驱动 <GZRouterView> 过渡动画和 <GZModalView> 弹层栈的内部状态——这部分是 vue-router
 * 没有的概念，因为 vue-router 只有单一的“当前路由视图”，没有“页面栈 + 可叠加的弹层栈”的设计。
 *
 * seq 是页面栈和弹层栈共用的同一个单调递增序号，这一点很关键：它让两个栈的历史条目落在
 * 同一条时间线上，物理前进/后退时才能只凭 seq 判断“这一步该从哪个栈里找、该动哪个栈”，
 * 不需要额外记录“这一步操作的是页面还是弹层”。
 */
export function createGZRouter(options: GZRouterOptions): GZRouter {
  const { routes, syncBrowserHistory = false } = options;
  const initialUrl = options.initialUrl ?? '/';
  const canUseHistory = syncBrowserHistory && typeof window !== 'undefined';

  let uid = 0;
  const stack = shallowReactive<StackEntry[]>([]);
  const modalStack = shallowReactive<StackEntry[]>([]);
  const direction = ref<Direction>('none');

  const beforeEachGuards: NavigationGuard[] = [];
  const afterEachHooks: AfterHook[] = [];
  const leaveGuardsMap = new Map<number, Set<NavigationGuard>>();
  const updateGuardsMap = new Map<number, Set<NavigationGuard>>();

  function makeEntry(matched: MatchedRoute, seq: number, reuseId?: number): StackEntry {
    const id = reuseId ?? (uid += 1);
    return { id, seq, matched };
  }

  const seqAllocator = createSeqAllocator(canUseHistory);
  const startUrl = canUseHistory ? currentLocation() : initialUrl;
  const existingState = canUseHistory ? readExistingState() : null;
  const initialSeq = existingState ? existingState.seq : seqAllocator.next();
  seqAllocator.writeBaseSeqOnce(initialSeq);
  const baseSeq = seqAllocator.readBaseSeq(initialSeq);

  const currentSeq = ref(initialSeq);
  const canGoBack = computed(() => stack.length > 1 || currentSeq.value > baseSeq);

  const top = computed(() => stack[stack.length - 1]);
  const topModal = computed(() => modalStack[modalStack.length - 1]);

  // currentRoute 用 reactive 对象（而不是 ref/computed）承载，字段原地更新，
  // 这样 useRoute() 拿到的对象可以像 vue-router 一样直接 `route.params.id` 访问，无需 `.value`
  const currentRoute = reactive<RouteLocationNormalized>({ ...UNKNOWN_LOCATION });

  function initLanding() {
    const matched = matchByUrl(routes, startUrl) ?? matchByUrl(routes, initialUrl);
    if (!matched) return;
    const from = { ...currentRoute };
    if (matched.route.meta?.modal) {
      // 落地页本身就是弹层路由（直接访问/刷新停在这个 URL）：背景页默认用 initialUrl，
      // 因为浏览器不允许我们读取“真正的上一条历史记录对应哪个路由”。
      // 弹层栈本身也只能重建出这一层——刷新前如果叠了多层弹层，更深的那些无法恢复。
      const background = matchByUrl(routes, initialUrl);
      if (background) stack.push(makeEntry(background, initialSeq));
      modalStack.push(makeEntry(matched, initialSeq));
    } else {
      stack.push(makeEntry(matched, initialSeq));
    }
    Object.assign(currentRoute, toLocation(matched));
    // 首屏落地不跑 beforeEach/beforeEnter——没有“取消后回退到哪”的合理去处，会让应用卡在空白页；
    // 这点和 vue-router 不完全一致（它会跑，但那也是个常见的footgun）。afterEach 这类只读副作用
    // （比如这里 demo 用的“根据 meta.title 设置文档标题”）仍然需要跑到，所以单独触发一次。
    // 用 queueMicrotask 延后到本轮同步代码结束之后，让 createGZRouter() 返回后紧跟着调用的
    // router.afterEach(...) 有机会先完成注册。
    queueMicrotask(() => {
      afterEachHooks.forEach((hook) => hook(currentRoute, from));
    });
  }
  initLanding();

  if (canUseHistory) {
    replaceHistory(initialSeq, startUrl);
  }

  async function withGuards(
    guards: NavigationGuard[],
    to: RouteLocationNormalized,
    mutate: () => void,
  ): Promise<boolean> {
    const from = { ...currentRoute };
    const outcome = await runGuardSequence(guards, to, from);
    if (!outcome.allowed) {
      if (outcome.redirect) {
        const redirectUrl = typeof outcome.redirect === 'string' ? outcome.redirect : resolveUrl(routes, outcome.redirect);
        // 这里必须和“当前实际所在的路由”比较，而不是和被拦截的目标 to 比较：
        // 守卫还没放行，mutate() 从未执行，currentRoute 就是用户实际停留的页面。
        // 如果重定向目标就是这个页面，什么都不用做——否则会把“重定向回原地”误判成
        // 一次新的前进导航，把同一个页面重复 push 一层，凭空多播一次过渡动画。
        if (redirectUrl !== currentRoute.fullPath) push(redirectUrl);
      }
      return false;
    }
    mutate();
    Object.assign(currentRoute, to);
    afterEachHooks.forEach((hook) => hook(to, from));
    return true;
  }

  function pushModal(matched: MatchedRoute, url: string) {
    // 打开新弹层不会让下面已经开着的弹层/背景页“离开”——它们本来就还挂载着，
    // 所以不用跑任何 leave 守卫，和页面栈 push() 对“上一页”的处理是同一个逻辑。
    const guards = [...beforeEachGuards, ...collectChainGuards(matched)];
    void withGuards(guards, toLocation(matched), () => {
      const seq = seqAllocator.next();
      modalStack.push(makeEntry(matched, seq));
      currentSeq.value = seq;
      if (canUseHistory) pushHistory(seq, url);
    });
  }

  function replaceModal(matched: MatchedRoute, url: string) {
    const currentTopModal = topModal.value;
    // 比较 chain[0]（链根）而不是 route（叶子）：未嵌套路由 chain[0] 就是叶子，行为不变；
    // 嵌套路由的话，只要链根（布局）相同就复用同一个 entry.id，布局组件实例不会被重建，
    // 只有链上更深的部分会跟着 chain 变化重新渲染（见 GZRouterView 的嵌套渲染逻辑）。
    const isUpdate = !!currentTopModal && currentTopModal.matched.chain[0].component === matched.chain[0].component;
    const guards = [
      ...(isUpdate ? Array.from(updateGuardsMap.get(currentTopModal!.id) ?? []) : []),
      ...(!isUpdate && currentTopModal ? Array.from(leaveGuardsMap.get(currentTopModal.id) ?? []) : []),
      ...beforeEachGuards,
      ...collectChainGuards(matched),
    ];
    void withGuards(guards, toLocation(matched), () => {
      const seq = seqAllocator.next();
      const newEntry = makeEntry(matched, seq, isUpdate ? currentTopModal!.id : undefined);
      if (currentTopModal) {
        // replace 销毁上一层：只替换栈顶这一层，它下面如果还叠着别的弹层/背景页，原样保留
        modalStack.splice(modalStack.indexOf(currentTopModal), 1, newEntry);
      } else {
        modalStack.push(newEntry);
      }
      currentSeq.value = seq;
      if (canUseHistory) replaceHistory(seq, url);
    });
  }

  function push(to: RouteLocationRaw) {
    const url = resolveUrl(routes, to);
    const matched = matchByUrl(routes, url);
    if (!matched) {
      console.warn(`[gz-vue-router] no route matches "${url}"`);
      return;
    }
    if (matched.route.meta?.modal) {
      pushModal(matched, url);
      return;
    }
    const outgoing = modalStack.length === 0 ? top.value : null;
    const guards = [
      ...(outgoing ? Array.from(leaveGuardsMap.get(outgoing.id) ?? []) : []),
      ...beforeEachGuards,
      ...collectChainGuards(matched),
    ];
    void withGuards(guards, toLocation(matched), () => {
      const seq = seqAllocator.next();
      direction.value = 'forward';
      stack.push(makeEntry(matched, seq));
      currentSeq.value = seq;
      if (canUseHistory) pushHistory(seq, url);
    });
  }

  function replace(to: RouteLocationRaw) {
    const url = resolveUrl(routes, to);
    const matched = matchByUrl(routes, url);
    if (!matched) return;
    if (matched.route.meta?.modal) {
      replaceModal(matched, url);
      return;
    }
    const currentTop = top.value;
    // 同上：比较链根而不是叶子，让嵌套路由里共享的布局在兄弟子路由之间切换时不会被重新挂载
    const isUpdate =
      !!currentTop && modalStack.length === 0 && currentTop.matched.chain[0].component === matched.chain[0].component;
    const guards = [
      ...(isUpdate ? Array.from(updateGuardsMap.get(currentTop!.id) ?? []) : []),
      ...(!isUpdate && currentTop && modalStack.length === 0 ? Array.from(leaveGuardsMap.get(currentTop.id) ?? []) : []),
      ...beforeEachGuards,
      ...collectChainGuards(matched),
    ];
    void withGuards(guards, toLocation(matched), () => {
      direction.value = 'none';
      const seq = seqAllocator.next();
      const newEntry = makeEntry(matched, seq, isUpdate ? currentTop!.id : undefined);
      if (currentTop) {
        stack.splice(stack.indexOf(currentTop), 1, newEntry);
      } else {
        stack.push(newEntry);
      }
      currentSeq.value = seq;
      if (canUseHistory) replaceHistory(seq, url);
    });
  }

  function back(fallbackUrl = initialUrl) {
    if (modalStack.length > 0) {
      const leaving = topModal.value!;
      const below = modalStack[modalStack.length - 2];
      const to = below ? toLocation(below.matched) : top.value ? toLocation(top.value.matched) : UNKNOWN_LOCATION;
      const guards = [...Array.from(leaveGuardsMap.get(leaving.id) ?? []), ...beforeEachGuards];
      void withGuards(guards, to, () => {
        modalStack.pop();
        currentSeq.value = topModal.value?.seq ?? top.value?.seq ?? currentSeq.value;
        if (canGoBack.value) {
          if (canUseHistory) goBackInHistory();
        } else if (canUseHistory) {
          const fallbackTarget = below?.matched.url ?? top.value?.matched.url ?? fallbackUrl;
          replaceHistory(currentSeq.value, fallbackTarget);
        }
      });
      return;
    }
    if (stack.length > 1) {
      const leaving = top.value!;
      const to = toLocation(stack[stack.length - 2].matched);
      const guards = [...Array.from(leaveGuardsMap.get(leaving.id) ?? []), ...beforeEachGuards];
      void withGuards(guards, to, () => {
        direction.value = 'backward';
        stack.pop();
        currentSeq.value = top.value?.seq ?? currentSeq.value;
        if (canUseHistory) goBackInHistory();
      });
      return;
    }
    if (canGoBack.value) {
      // 浏览器不暴露上一条历史记录对应哪个路由，这里凑不出精确的 to，
      // 只能先跑 leave 守卫 + beforeEach；真正的目标路由要等 popstate 触发后才知道，
      // 到时会在 popstate 里补跑一次完整守卫链（包含目标路由的 beforeEnter）
      const leaving = top.value;
      const guards = [...(leaving ? Array.from(leaveGuardsMap.get(leaving.id) ?? []) : []), ...beforeEachGuards];
      void withGuards(guards, UNKNOWN_LOCATION, () => {
        if (canUseHistory) goBackInHistory();
      });
      return;
    }
    // 这个 tab 里压根没有更早的历史：跳到 fallback（默认首页），替换当前记录而不是新增一条
    const matched = matchByUrl(routes, fallbackUrl);
    if (!matched) return;
    const leaving = top.value;
    const guards = [...(leaving ? Array.from(leaveGuardsMap.get(leaving.id) ?? []) : []), ...beforeEachGuards];
    void withGuards(guards, toLocation(matched), () => {
      direction.value = 'backward';
      const seq = seqAllocator.next();
      stack.splice(0, stack.length, makeEntry(matched, seq));
      currentSeq.value = seq;
      if (canUseHistory) replaceHistory(seq, fallbackUrl);
    });
  }

  function forward() {
    goInHistory(1);
  }
  function go(delta: number) {
    goInHistory(delta);
  }

  if (canUseHistory) {
    window.addEventListener('popstate', (event) => {
      const state = event.state as { seq?: number } | null;
      if (!state || typeof state.seq !== 'number') return;

      const modalIndex = modalStack.findIndex((entry) => entry.seq === state.seq);
      if (modalIndex !== -1) {
        if (modalIndex < modalStack.length - 1) {
          // 弹层栈内部的前进/后退：页面栈完全不受影响，只截断弹层栈。
          // 命中这个分支必然是“后退”（找到的是数组里更靠前的位置），撤销时要 go(1) 而不是 go(-1)。
          const to = toLocation(modalStack[modalIndex].matched);
          const leaving = topModal.value!;
          const guards = [...Array.from(leaveGuardsMap.get(leaving.id) ?? []), ...beforeEachGuards];
          void withGuards(guards, to, () => {
            modalStack.splice(modalIndex + 1);
            currentSeq.value = state.seq!;
          }).then((allowed) => {
            if (!allowed) goInHistory(1);
          });
        }
        return;
      }

      const pageIndex = stack.findIndex((entry) => entry.seq === state.seq);
      if (pageIndex !== -1) {
        // 回到了某个页面级历史记录：它一定早于当前所有弹层被打开的时间点（seq 更小），
        // 所以现在挂着的弹层都要一并关闭
        if (pageIndex < stack.length - 1 || modalStack.length > 0) {
          const to = toLocation(stack[pageIndex].matched);
          const leaving = modalStack.length > 0 ? null : top.value!;
          const guards = [
            ...(leaving ? Array.from(leaveGuardsMap.get(leaving.id) ?? []) : []),
            ...beforeEachGuards,
          ];
          void withGuards(guards, to, () => {
            direction.value = 'backward';
            modalStack.splice(0, modalStack.length);
            stack.splice(pageIndex + 1);
            currentSeq.value = state.seq!;
          }).then((allowed) => {
            if (!allowed) goInHistory(1);
          });
        }
        return;
      }

      // 两个栈里都找不到目标 seq：绝大多数情况是“刷新/直接跳转导致丢失了历史记录”，
      // 此时唯一可靠的信息是浏览器已经把地址栏改到了正确的 URL
      const matched = matchByUrl(routes, currentLocation());
      if (!matched) return;
      const referenceSeq = topModal.value?.seq ?? top.value?.seq ?? 0;
      const goingBackward = state.seq < referenceSeq;
      if (matched.route.meta?.modal) {
        // 落到了一个弹层 URL 上：不管 modalStack 现在是空的（刷新丢了历史）还是已经有
        // 别的弹层在下面（比如物理前进重新落到这一层，下面那层从未被清空过），都用 push
        // 叠加而不是整体替换——替换会把还在的下层弹层也顶掉。
        const guards = [...beforeEachGuards, ...collectChainGuards(matched)];
        void withGuards(guards, toLocation(matched), () => {
          modalStack.push(makeEntry(matched, state.seq!));
          currentSeq.value = state.seq!;
        }).then((allowed) => {
          if (!allowed) goInHistory(goingBackward ? 1 : -1);
        });
        return;
      }
      const leaving = top.value;
      const guards = [
        ...(leaving ? Array.from(leaveGuardsMap.get(leaving.id) ?? []) : []),
        ...beforeEachGuards,
        ...collectChainGuards(matched),
      ];
      void withGuards(guards, toLocation(matched), () => {
        direction.value = goingBackward ? 'backward' : 'forward';
        modalStack.splice(0, modalStack.length);
        stack.splice(0, stack.length, makeEntry(matched, state.seq!));
        currentSeq.value = state.seq!;
      }).then((allowed) => {
        if (!allowed) goInHistory(goingBackward ? 1 : -1);
      });
    });
  }

  function beforeEach(guard: NavigationGuard) {
    beforeEachGuards.push(guard);
    return () => {
      const idx = beforeEachGuards.indexOf(guard);
      if (idx >= 0) beforeEachGuards.splice(idx, 1);
    };
  }
  function afterEach(hook: AfterHook) {
    afterEachHooks.push(hook);
    return () => {
      const idx = afterEachHooks.indexOf(hook);
      if (idx >= 0) afterEachHooks.splice(idx, 1);
    };
  }

  function registerGuard(map: Map<number, Set<NavigationGuard>>, entryId: number, guard: NavigationGuard) {
    if (!map.has(entryId)) map.set(entryId, new Set());
    map.get(entryId)!.add(guard);
  }
  function unregisterGuard(map: Map<number, Set<NavigationGuard>>, entryId: number, guard: NavigationGuard) {
    map.get(entryId)?.delete(guard);
  }

  const router: GZRouter = {
    currentRoute,
    push,
    replace,
    back,
    forward,
    go,
    beforeEach,
    afterEach,
    stack,
    modalStack,
    direction,
    canGoBack,
    _registerLeaveGuard: (entryId, guard) => registerGuard(leaveGuardsMap, entryId, guard),
    _unregisterLeaveGuard: (entryId, guard) => unregisterGuard(leaveGuardsMap, entryId, guard),
    _registerUpdateGuard: (entryId, guard) => registerGuard(updateGuardsMap, entryId, guard),
    _unregisterUpdateGuard: (entryId, guard) => unregisterGuard(updateGuardsMap, entryId, guard),
    install(app: App) {
      app.provide(ROUTER_KEY, router);
      app.provide(ROUTE_KEY, currentRoute);
      // 故意不设置 app.config.globalProperties.$router/$route。
      // Vuetify 的 VOverlay/VDialog 会自动探测 `$router` 是否存在（vm.proxy.$router），
      // 一旦探测到就会调用它的 beforeEach/afterEach 挂自己的“物理返回关闭弹层”逻辑
      // （VOverlay 的 closeOnBack 特性），这套逻辑假设的是 vue-router 的真实行为——
      // 而我们已经在 popstate 里自己正确处理了“物理返回关闭最上层弹层”，两边同时生效
      // 会互相打架，表现为守卫无限触发、页面卡死。详见 bugs/0002。
    },
  };

  return router;
}

export type { RouteRecordRaw };
