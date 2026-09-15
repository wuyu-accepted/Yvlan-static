# Yvlan Static Demo

CampusPulse / ForumTwin 的公开静态演示站。仓库只包含 Vue 3 + Vite 前端和脱敏、哈希绑定的公开案例资产，不包含后端、数据库、API Key、Provider 请求账本或私有 Agent 数据。

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

公开演示模式保留产品介绍、案例中心、论坛调查、结果证据、模型与数据以及创新评测页面；需要后端写操作的项目创建、工作台、实时运行和运行分析路由会返回案例中心。

## 数据边界

- 页面不得生成缺失帖子、传播关系、Claim、LLM 调用或治理结果。
- 资产缺失或 SHA-256 不一致时必须失败关闭。
- 合成 Agent 和模拟结果不是现实学生身份、民意调查或政策因果估计。
