---
type: article
title: antd-overlay：为什么我更倾向于命令式调用
date: 2026-11-06
summary: 同一个表单弹窗，每换一个入口，除了开关，还要准备一份初始数据。介绍我用 antd-overlay 整理这套调用的方式：数据直接传进去，表单在内部处理，完成后再把结果交回来。
tags:
  - 造物
keywords:
  - antd-overlay
  - React
  - Ant Design
  - 命令式覆盖层
  - 命令式弹窗
---

我用 React 和 Ant Design 已经很多年了。做业务的时候，弹窗几乎到处都是。修改资料、选择成员、配置任务，很多操作都需要临时打开一个界面，做完以后再回到原来的页面。

弹窗里的内容通常已经封装好了，但每换一个地方使用，还是要重新声明节点、管理开关、准备初始数据，再接上确认和取消的回调。

这些代码都知道怎么写。只是同样的东西写得多了，总会觉得有些麻烦。

尤其是表单弹窗。点击某条记录时，明明已经拿到了要编辑的数据，还得先放进父组件的 state，再通过 JSX 传给弹窗。等用户改完，又从另一个回调里把结果接回来。

我更希望需要的时候直接调用它：把初始数据传进去，弹窗自己处理里面的交互，完成以后再告诉我结果。

[antd-overlay](https://github.com/RaineySpace/antd-overlay) 就是我为此做的项目。它为 Ant Design 的 Modal、Drawer 和 Tour 提供命令式调用，也可以接入自定义覆盖层。

## 初始数据也不必在父组件里中转

拿一个成员列表来讲。列表里共用一个修改名称的弹窗，点击哪一行，就把那个成员的原名称填进去。

常见的写法是，父组件记录当前正在编辑谁，再把数据传给弹窗。下面的 `MemberList` 和 `RenameDialog` 都是已经封装好的业务组件，后者负责输入、校验和表单重置：

```tsx
type Member = {
  id: string;
  name: string;
};

type MembersPageProps = {
  members: Member[];
  onRename: (id: string, name: string) => void;
};

function MembersPage({ members, onRename }: MembersPageProps) {
  const [open, setOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  return (
    <>
      <MemberList
        members={members}
        onRename={(member) => {
          setEditingMember(member);
          setOpen(true);
        }}
      />
      <RenameDialog
        open={open}
        initialName={editingMember?.name ?? ''}
        onCancel={() => setOpen(false)}
        onConfirm={(nextName) => {
          if (!editingMember) return;
          onRename(editingMember.id, nextName);
          setOpen(false);
        }}
      />
    </>
  );
}
```

这里的 `members` 是页面本来就需要的数据。`editingMember` 则是专门为弹窗准备的：点击时拿到 `member`，先存起来，后面的 JSX 和确认回调再从这里取。

如果表单还有新建、编辑两种模式，或者需要带上一些默认选项，调用时准备的东西还会更多。它们当然可以放进同一个 state，但父组件还是得管理这份数据，记得什么时候赋值、什么时候使用。

换成命令式调用，可以直接在点击时把数据交出去：

```tsx
function MembersPage({ members, onRename }: MembersPageProps) {
  const openRename = useGlobalModal(RenameModal);

  return (
    <MemberList
      members={members}
      onRename={(member) =>
        openRename({
          initialName: member.name,
          customOk: ({ name }) => onRename(member.id, name),
        })
      }
    />
  );
}
```

这次点击已经拿到了 `member`，初始名称就直接传进去。确认后，回调里的 `member.id` 仍然指向这次编辑的成员，可以用它更新对应的记录。

`editingMember` 这个中转状态就不需要了，弹窗的开关也不用再写一遍。

我觉得这才是这类封装更有用的地方。原数据怎么填进表单，编辑到一半的内容怎么保留，字段怎样联动，什么时候校验，这些都可以在业务弹层里处理。外面的页面只需要决定编辑谁，以及拿到结果以后做什么。

具体的表单逻辑仍然需要自己实现。`antd-overlay` 保存调用参数、管理覆盖层，业务组件维护自己的表单草稿，避免直接改动传入的原始对象。

声明式组件也能把表单逻辑封装好。如果页面本来就有选中项，直接拿来作为编辑对象，也未必需要多加一个 state。我更喜欢命令式调用的场景，是数据已经在事件里拿到了，接下来只想打开界面，等用户操作完再继续。此时直接传入，会省去不少来回连接的代码。

## 弹窗里面照常写

调用方式变了，弹窗内部还是熟悉的 React。

继续看前面的修改名称。它只需要接收初始值，让用户输入，再把确认后的名称交出去：

```tsx
import { useState } from 'react';
import { Input, Modal } from 'antd';
import type { CustomModalProps } from 'antd-overlay';

interface RenameModalProps
  extends CustomModalProps<{ name: string }> {
  initialName?: string;
}

export function RenameModal({
  initialName = '',
  customClose,
  customOk,
  ...modalProps
}: RenameModalProps) {
  const [name, setName] = useState(initialName);

  return (
    <Modal
      {...modalProps}
      title="修改名称"
      onCancel={customClose}
      onOk={() => customOk?.({ name })}
    >
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
    </Modal>
  );
}
```

`initialName` 是初始值，`customOk` 接收确认结果，`customClose` 用来关闭。结果的类型写在 `CustomModalProps` 里，调用时就能得到相应的类型检查和提示。

`modalProps` 要继续传给 Modal，其中有库注入的 `open` 和动画回调。漏掉这些，弹窗可能打不开，或者关闭以后没办法完成清理。

所以，命令式调用并没有改变 React 渲染界面的方式。调用 `openRename` 后，库内部更新状态，Modal 仍然根据 props 决定怎样显示。表单里的输入、校验和提交反馈，也继续按平时的方式编写。

[React 官方](https://react.dev/reference/react/useImperativeHandle#pitfall)建议，能通过 props 表达的控制关系，优先使用 props，文档里也拿 Modal 的显隐举了例子。我保留了组件受控的这一层，只把业务里反复出现的调用过程封装起来。

这也让我不用再把入口按钮和弹窗绑在一起。列表操作、菜单项、快捷键，都可以打开同一个弹窗。入口长什么样、什么时候触发，由使用它的地方决定。

常用的业务弹窗还可以导出专用 Hook：

```tsx
export const {
  useGlobalModal: useRenameModal,
} = generateUseModalHook(RenameModal);
```

其他地方引入 `useRenameModal` 就能使用。以后调整表单布局、增加内部联动，只要传入的参数和返回的结果没有变，各个入口就不用跟着改一遍。要找哪里用了这个弹窗，也可以直接沿着 Hook 的引用去看。

## 等用户操作完，再往下走

很多时候，打开弹窗只是事情做到一半，需要等用户补充一点信息。

比如创建发送任务：先选择素材，再填写发送配置，最后提交。按确认回调来写，选择素材的回调里要打开配置，配置的回调里再提交任务。上一步选了什么，还得想办法留给下一步使用。

我更愿意把这些步骤放在一起，按顺序读下来。Promise 刚好适合表达这个过程：

```tsx
function useCreateSendTask() {
  const pickMaterials = useGlobalPromiseModal(MaterialPickerModal);
  const requestSettings = useGlobalPromiseModal(SendSettingsModal);

  return async () => {
    const materials = await pickMaterials({ multiple: true });
    if (materials === undefined) return;

    const settings = await requestSettings({
      materialIds: materials.ids,
    });
    if (settings === undefined) return;

    await submitTask({
      materialIds: materials.ids,
      targetIds: settings.targetIds,
    });
  };
}
```

这里假设素材选择和发送配置都已经封装成组件。先选素材，选完继续配置，最后提交。用户在哪一步取消，就在哪里结束。

`materials` 只在这次调用里使用，放在局部变量里就够了。它不参与外层页面的渲染，也就不用为了从一个回调传到另一个回调，再专门存进页面 state。

素材选择器也不用知道这些素材最后要发给谁。它把选中的结果交出来，外面接着做自己的事情。换到其他业务里，同样的选择器还能继续用。

如果要测试这段流程，还可以把它提取成独立函数，传入几个返回固定结果的选择函数，看看取消后是否停止、提交参数是否正确。界面里的搜索、选择和确认，再分别验证。

取消也是这个流程的一部分。`antd-overlay` 的 Promise 版本返回 `Promise<T | undefined>`，确认成功后拿到的是 `customOk(value)` 传入的 `value`，取消则返回 `undefined`。判断时写清楚 `result === undefined`，就不会把 `false`、`0` 这样的有效结果也当成取消。

提交失败时要多留意一下。`customOk` 抛错或 reject，会让外层 Promise 也 reject，弹窗继续保持打开。但同一个 Promise 只能结算一次，后面重新提交，不会让已经失败的那次等待变成成功。所以，允许用户修改后重试的字段校验，适合先在表单内部处理，等结果有效了再交出来。

同一个 Hook 重新打开时，也会替换当前内容，前一次还没结束的等待返回 `undefined`。它只结束这次等待，不会替业务中断已经发出去的请求。重复点击、请求取消，以及复杂向导里的返回上一步和草稿恢复，仍然需要按具体业务处理。

## 关闭以后，还要等动画结束

把开关藏进一个函数里并不难。真正需要处理完整的，是打开以后到关闭结束的这段过程。

比如用户点击取消，弹窗应该先开始退出动画。如果马上把组件卸载，动画也就没了。

因此，`antd-overlay` 内部用 `open` 控制显隐，用 `renderEnable` 决定是否挂载。默认情况下，Modal 关闭时先把 `open` 设为 `false`，等 `afterClose` 再卸载；Drawer 则等 `afterOpenChange(false)`。Tour 没有对应的关闭动画完成回调，当前默认直接卸载。

Promise 不需要等动画播完。结果确定以后，业务代码就可以继续执行，界面完成自己的退出过程。

### Context 要放在能读到的地方

使用全局 Hook 时，需要在应用里配置 Provider：

```tsx
import { ConfigProvider } from 'antd';
import { AntdOverlayProvider } from 'antd-overlay';

function Root() {
  return (
    <ConfigProvider>
      <AntdOverlayProvider>
        <YourApp />
      </AntdOverlayProvider>
    </ConfigProvider>
  );
}
```

这里把 `ConfigProvider` 放在外面，覆盖层就能读到对应的配置。如果某个页面内部还有自己的 Provider，全局覆盖层不会因为是在那个页面里打开的，就自动读到它。

Context 跟着 React 组件树走。需要页面里的上下文时，可以用局部版本 `useModal`，把返回的 `holder` 放进那个 Provider 里。

每次调用 Hook 都有自己的状态，全局 Provider 负责统一挂载。调用方卸载时，对应覆盖层会清理，Promise 版本也会结束还没完成的等待。因此，使用全局 Hook 时，同样需要考虑调用方会在什么时候卸载。

### 性能要看实际挂载了什么

性能也不能只看调用方式。

`antd-overlay` 在真正打开时才挂载业务覆盖层。全局 Hook 没打开时不注册空 holder，关闭动画结束后再移除节点。Provider 把 holder 列表留在内部，Context 只提供注册方法和默认配置，增删 holder 就不会通过 Context 通知所有调用方重渲染。

这些处理能减少一部分不必要的工作，但每个调用方自身的 Hook、业务订阅和 DOM 仍然有成本，父组件更新时也仍然遵循 React 的渲染规则。

声明式写法同样可以按需挂载。[Ant Design 的 Modal](https://ant.design/components/modal/#api)也提供 `forceRender`、`destroyOnHidden` 等选项。所以，不能看到 JSX 里放了一个 Modal，就认定里面的业务内容一直挂着。

我更在意的是，这些挂载、关闭和清理的处理能不能统一下来。接入新的业务弹窗时，沿用这套实现，就不用在每个入口重新处理关闭动画和卸载时机。

## 不只是表单弹窗

表单之外，各种选择器也很适合这样调用。选成员、选素材、选目录，传入筛选条件和初始选择，用户确认后拿回结果。选择器内部可以有搜索、分页和多选，调用处不需要把这些过程再管理一遍。

有时，编辑到一半还需要补建一个选项。比如选标签时发现少了一个，就打开新建标签的界面，创建完成后，把新标签带回当前表单。新建和选择各自处理自己的事情，通过结果连接起来。

临时查看详情，可以使用 `useGlobalDrawer`。在列表里打开某条记录，看完关闭，原来的位置还在。需要从详情里选择一些内容，也可以通过 `useGlobalPromiseDrawer` 取回结果。

导入文件、批量处理任务时，还可以先打开进度界面。普通 Hook 返回的 controller 提供 `update` 和 `close`，任务推进时更新属性，结束后关闭。关掉进度窗口是否要同时取消任务，需要业务自己约定。

Tour 可以在用户点击“了解这个功能”时打开，也可以接在某个操作后面，继续提示下一步。目标元素准备好以后，传入引导步骤即可。当前 Tour 没有 Promise Hook，使用 `useTour` 或 `useGlobalTour` 调用。

这些业务组件都需要自己实现。遇到其他覆盖层，也可以用 `useOverlay` 的 `propsAdapter`，把显隐、关闭和动画结束信号接到组件对应的属性上，继续使用同一套管理方式。

## 有些状态，还是该留在页面里

用得顺手以后，也没必要把所有弹窗都改成命令式。

如果一个抽屉是否打开由 URL 决定，或者它必须一直跟着页面的选中项、持久化草稿变化，直接通过 props 驱动就很自然。页面已经知道该显示什么，再加一份内部状态，反而要考虑两边怎样同步。

命令式调用传入的是当次参数。外部数据后来变了，需要主动 `controller.update`，或者让覆盖层自己订阅数据。`update` 是浅合并 props，组件内部单独保存的表单值也不会跟着自动改变。这些都需要在写组件时想清楚。

如果只是一个简单的确认提示，[Ant Design 的 `Modal.useModal()`](https://ant.design/components/modal/#modalusemodal)已经支持 Context，也可以 `await modal.confirm()`，直接用就很好。

我更愿意把命令式调用用在那些反复出现的临时交互里。点击时有现成的数据，打开后让用户完成一件事，结束以后，再把结果交回业务。编辑表单、选择器，以及前后相接的几步操作，都很适合这样组织。

项目放在 [GitHub](https://github.com/RaineySpace/antd-overlay)，可以通过下面的命令安装：

```bash
pnpm add antd-overlay
```

以后再给某个页面增加编辑入口，我希望调用处只需要关心两件事：这次传什么进去，完成以后拿结果做什么。表单里的输入、校验和提交，就在弹层内部处理好。
