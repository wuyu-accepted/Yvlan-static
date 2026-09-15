# Yvlan Static Demo

CampusPulse / ForumTwin 的公开静态演示站。仓库包含 Vue 3 + Vite 前端，以及脱敏、哈希绑定的公开案例资产。

当前页面组件、布局、动效和设计令牌同步自原仓库 `main` 的 `57de822` 版本；静态模式仅保留公开案例所需入口。

## 本地运行

```bash
npm ci
npm run dev
```

公开演示模式构建：

```bash
VITE_PUBLIC_DEMO=true VITE_BASE_PATH=/Yvlan-static/ npm run build -- --configLoader runner
```

Windows PowerShell：

```powershell
$env:VITE_PUBLIC_DEMO='true'
$env:VITE_BASE_PATH='/Yvlan-static/'
npm run build -- --configLoader runner
```

## 公网部署

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会自动构建并部署到 GitHub Pages。

公开演示模式保留产品封面、案例中心、论坛调查、结果证据以及团队致谢页面；其他操作型路由会返回产品封面。

## 数据边界

- 页面不得生成缺失帖子、传播关系、Claim、LLM 调用或治理结果。
- 资产缺失或 SHA-256 不一致时必须失败关闭。
- 合成 Agent 和模拟结果不是现实学生身份、民意调查或政策因果估计。
