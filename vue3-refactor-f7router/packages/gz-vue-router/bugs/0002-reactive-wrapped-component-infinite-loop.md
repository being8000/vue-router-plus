# 0002. 本地镜像数组用 `reactive()` 包裹组件定义，导致页面卡死

- **日期**：2026-07-17
- **涉及文件**：`src/components/GZModalView.vue`（多层弹层栈的第一版实现，后已推翻重写）

## 现象

实现多层弹层栈时，第一版 `<GZModalView>` 为了在关闭时保留 Vuetify `<v-dialog>` 自己的退场动画，
在组件内部维护了一份本地镜像数组 `visible`，用两阶段状态（先把 `open` 置为 `false` 播放关闭动画，
`@afterLeave` 后再真正从数组里摘除）。刚打开第二层弹层，Chromium 就完全卡死，控制台疯狂刷屏：

```
[Vue warn]: Vue received a Component that was made a reactive object. This can lead to
unnecessary performance overhead and should be avoided by marking the component with
`markRaw` or using `shallowRef` instead of `ref`.
```

## 根因

```ts
const visible = reactive<VisibleModal[]>([]);
...
visible.push({ entry, open: true }); // entry.matched.route.component 是原始的 Vue 组件定义对象
```

`reactive()` 是深层代理：push 进去的 `entry` 对象里挂着 `matched.route.component`（路由配置里
写的那个组件本身），会被 Vue 深层代理成一个 Proxy。`<component :is="...">` 每次渲染都会重新读到
一个"看起来不一样"的组件引用（代理对象 vs 原始对象），Vue 认为组件变了，于是不断卸载重建，
重建又触发同一层 `reactive` 代理逻辑……如此循环，CPU 打满，页面彻底无响应。

## 修复（当时的修复，后续被整体重写取代）

把本地镜像数组换成 `shallowReactive`（数组本身仍然响应式，但里面的对象不做深层代理），
每一项的 `open` 标记单独用一个 `ref<boolean>`（因为 `shallowReactive` 数组里对象字段的原地修改
不会被追踪到，这正是 [CLAUDE.md](../CLAUDE.md) 第 4 条踩过的同一个坑，这次是在组件层面又踩了一次）。

## 后续

这一版 `<GZModalView>`（连同它试图保留的 v-dialog 关闭动画）在 [0003](./0003-vdialog-closeonback-conflict.md)
里被整体推翻，改成完全自己实现遮罩+卡片、不再依赖 `<v-dialog>`。但这条教训本身仍然成立、
仍然适用于任何"把 `router.stack`/`router.modalStack` 里的 entry 复制到组件本地状态"的场景：
**只要 entry 里含有 `matched.route.component`，本地状态容器就必须是 `shallowReactive`（或干脆不复制，
直接读 router 暴露的 shallowReactive 数组），绝不能用 `reactive()` 整个包一层。**
