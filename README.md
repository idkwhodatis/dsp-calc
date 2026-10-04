# DSP Calculator · React + shadcn/ui

A production-chain calculator for Dyson Sphere Program (戴森球计划量化计算器), with a React 19 interface built from checked-in shadcn/ui components, Radix primitives and Tailwind CSS.

The refactor preserves the existing game data, recipe choices, proliferation settings and mod combinations. Plans without independent sources retain the original calculation path; multi-source plans use explicit material balances with the same game recipes. The interface provides searchable item selection, responsive results, light/dark themes, settings, grouped production sources, and named demand/production presets.

## 同一物品的多来源产线

1. 添加生产目标，例如 **引力矩阵 60 / min**。
2. 选择 **添加现有产线 → 重氢**。新来源从 **0** 开始，保留原来的自动产线；重氢组仍位于原来的中间产物位置。
3. 组标题显示 **总需求 300 / min**。组内的自动产线与手动产线横向并排，各自显示产量、配方、建筑和增产设置。
4. 在新来源中选择轨道采集器、分馏或粒子对撞配方，再填写 **150 / min**。自动产线承担剩余 **150 / min**，原料、建筑与电力会一起重新计算。
5. 用组内 **添加产线** 继续拆分来源。超过需求时会显示多余产物；不会生成负的自动产量，也不会擅自平均分配各条产线。副产物供给单独列出。

分配数值表示可用于满足需求的**净产量**，循环配方内部重复使用的物品不会重复计入。每条手动产线有独立身份和设置；删除后由自动产线重新平衡。更多来源可在组内横向滚动。

来源分配自动保存在当前浏览器，**保存生产策略**也会保存这些来源。加载旧策略时，未包含来源的策略按无手动来源处理。旧的“自然产线”按保存的建筑数量和配置折算为每分钟产量，并保留原始记录备份。固定分配以每分钟储存，切换显示单位只换算其显示数值；现有目标产量输入的单位行为保持不变。

## Local development

Use **Node.js 24** (the same version as CI) and npm. The npm lockfile is the CI source of truth.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. On the first development start and on every production build, the Vite sprite plugin generates icon coordinates and PNG/WebP atlases from `icon/`. Generated files are ignored by Git; do not remove the source icons.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

`npm test` runs Vitest once. Use `npm run test:watch` while editing. The production output is `dist/`; `npm run preview` serves it locally. `npm run typecheck` checks the TypeScript shadcn/ui primitives; the existing calculator remains JavaScript/JSX.

### Regression coverage

`tests/solver.test.js` compares production, surplus, production rates and building counts with fixtures captured from the pre-refactor commit `d53123399a7ab6278d3d1b704e111bef728b727e`. The 28 scenarios cover every supported mod-data combination, basic iron/circuits, universe matrices, alternate recipes, factory selection, proliferation, mining rates, external supply, mineralization, existing production lines and the Void mod’s blue buff. Additional assertions cover default scheme isolation and building multipliers.

The fixture is deliberately independent of the current UI and solver. If an intentional calculation/data change needs a new baseline, review it explicitly. `node scripts/capture-solver-baseline.mjs` reproduces the original fixture from that Git commit (requires the commit in local history); do not regenerate fixtures merely to make a failing test pass.

### Verification notes

The refactor has numerical and DOM interaction tests, lint/typechecking, and verified production builds for both `/` and `/dsp-calc/`. The public deployment has been smoke-tested in a desktop browser for item search, production calculations, bulk building selection, themes and the PWA update flow. The item picker uses the original compact icon-grid placement; the overview uses content-sized columns, readable original-scale type/icons, comfortable row spacing and a desktop summary sidebar. Mobile styles have regression coverage, but a real mobile viewport visual check is still recommended; DOM tests do not replace visual review.

Multi-source regressions cover the gravity-matrix/deuterium example, independent source configuration, zero/full/excess allocations, removal, physical rate units, coproducts and self-recycling, numerical conservation, grouped DOM ordering, source identities and saved-data migration. The original numerical fixture remains unchanged.

For independent sources, fixed material flows are applied to the original planner first and the resulting balance is checked. A full balance solve is used when that plan cannot satisfy the actual flows, or when explicit surplus-avoidance costs require a complete objective. Ordinary splits therefore retain the existing automatic plan rather than opportunistically changing unrelated recipes. Shared power accounting also keeps hidden mines in totals and excludes mineralized external supply; blue-buff recipe changes are isolated from the saved game data.

Before release, open the preview on desktop and mobile widths; check item search, recipe/factory/proliferation controls, keyboard navigation and dialog focus, cancel/confirm flows, saved presets after reload, mod switching, light/dark themes, and the installed PWA update prompt.

## Deploy this fork to GitHub Pages

1. In your GitHub repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**. Do this before the first deployment; the workflow does not silently change repository settings.
3. Push this code to the **default branch** (currently `master`), or open **Actions → Validate and deploy GitHub Pages → Run workflow**, selecting the default branch.
4. After the workflow succeeds, open the deployment URL shown by the `github-pages` environment / Settings → Pages. A typical project URL is `https://<owner>.github.io/<repository>/`.

The workflow in `.github/workflows/pages.yml`:

- Installs locked dependencies with `npm ci` on Node.js 24, then runs lint, typechecking, tests and the production build
- Uses the official `configure-pages`, `upload-pages-artifact` and `deploy-pages` actions, without publishing a generated branch or needing a personal access token
- Takes its base path from `configure-pages`, so repository sites, account sites and configured custom domains receive the correct asset, manifest and service-worker paths
- Builds and validates pull requests without deploying them or granting them Pages write permissions
- Deploys only the current repository default branch, with `pages: write` and `id-token: write` scoped to the deploy job; builds have read-only repository permissions
- Keeps production deployments serial; pull-request checks cannot cancel them

If a GitHub environment approval is required by your repository, approve the waiting deployment in Actions. Set a custom domain in **Settings → Pages**; do not hard-code a repository name into Vite.

To check the production build under a subdirectory before deploying (POSIX shell):

```sh
VITE_BASE_PATH=/dsp-calc/ npm run build
node scripts/verify-pages-build.mjs /dsp-calc/
npm run preview -- --base=/dsp-calc/
```

For root/custom-domain hosting, use `VITE_BASE_PATH=/` and pass `/` to the verification script. The normal local build defaults to `/`. Tauri builds retain the relative `./` base and omit service workers and the browser legacy bundle.

The verification script checks the emitted HTML asset links, PWA start URL/scope, manifest icons, service worker and game sprite files. It also runs in the Pages workflow. See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy#github-pages).

### Disabled upstream workflows

Only `.github/workflows/pages.yml` is active. All five inherited workflow files are preserved under `.github/disabled-workflows/`, outside the directory GitHub executes. Branch/PR previews, upstream Netlify publishing, the original release-branch Pages deploy, and tagged Tauri releases are disabled. They cannot run on pushes, pull requests, tags, schedules or manual dispatches while archived there.

The Pages workflow listens for branch pushes and checks the repository's current default branch at job time, so a rename from `main` to `master` does not silently stop deployment. Pull requests targeting the default branch still run validation without deployment. Manual runs deploy only when the selected ref is the default branch.

## UI and saved-data compatibility

- Shared shadcn/ui components live in `src/components/ui/`; `components.json` records their configuration. App styling uses semantic Tailwind theme tokens rather than Bootstrap or Ant Design.
- Original calculation logic remains in `src/global_state.jsx`; independent-source balances and per-source quantities live in `src/production_sources.js`. Data conversion remains in `src/GameData.jsx` and recipe initialization in `src/scheme_data.jsx`.
- Existing local-storage keys and game-scoped save formats are preserved: `scheme_data`, `needs_list`, `auto_scheme`, `auto_settings`, `auto_mods` and `theme`.
- Saves remain local to the current browser and origin. A fork's Pages URL has a different origin from the upstream domain, so it cannot automatically read saves stored on the upstream site. Save compatibility does not transfer browser storage between domains.
- Mod changes remain explicit because they can reset the current demand/production setup. PWA updates remain user-prompted.

## Upstream project

[Original repository](https://github.com/DSPCalculator/dsp-calc) · [Upstream live calculator](https://dsp-calc.pro/) · [Upstream Pages](https://dspcalculator.github.io/dsp-calc/)

The original algorithm notes and roadmap are retained below.

## 简介

对于以戴森球计划为例的生产类游戏，通过提取循环关键物品（以下简称关键物品）简化生产关系图，
仅对其中不得不参与线性规划的物品进行线性规划，绝大部分只有一条生产路径的物品直接通过递归获得上游产线数据。减少了不必要的耗时和单纯形法潜在的指数时间复杂度的隐患
并且通过这种方式获得了由上游低级材料到下游高级材料的物品列表，利用这个物品列表进行动态规划可以用于自动计算最优增产决策

同时，在代码中以item_graph记录了一个物品的上下生产关系，之后可以通过这个来追踪物品的用途，
与其他量化计算器不同的另一点是这边的喷涂不是按增产剂等级而是按增产点数层数计算的，这是为了后期方便计算摇匀混喷的情况

还有许多铺好了路但是还没完善的功能，在此就不一一细说了

具体思路可见：https://www.bilibili.com/read/readlist/rl630834 中涉及量化计算器的部分

## 开发路线图：

### 功能完善

- [ ] 界面优化和UI交互(希望大家广泛提意见)
- [ ] 限制/不限制物品获取来源时自动计算最优增产策略
- [ ] 自定义增产剂成本(其实已经可以实现了，但是不知道UI放哪比较好)
- [ ] 自定义矿物成本(同上)
- [ ] 自定义新配方(按自己的想法创造配方，不知道有没有用不过这边可以加)
- [ ] 自带mod或其它游戏的数据(按game_data的格式导入即可)

### 部署平台

- [x] PWA
- [x] 桌面端应用
- [x] 移动端UI适配 (基本完成，但可能还需要根据用户体验调整布局)
- [ ] 游戏内插件
