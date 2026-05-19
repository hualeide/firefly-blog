# Firefly 上线说明

## 已完成（我帮你做好的）

- [x] **`npm run build`** 成功，`dist/` 已生成
- [x] **Git** 已初始化并提交
- [x] **`vercel.json`** + **`.vercelignore`**
- [x] **Vercel 已登录**（你的账号），项目名：`firefly-blog-lenovo`
- [x] 本地预览可在 **http://localhost:4321** 打开（`npm run preview`）

## 公网地址（GitHub Pages，自动部署）

推送 `main` 分支后，GitHub Actions 会在云端构建并发布：

**https://hualeide.github.io/firefly-blog/**

首次需在仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。

（Vercel 命令行上传易失败；已改用 GitHub Pages。）

### 你只要做这两步（约 3 分钟）

**1. 登录 GitHub（终端里执行一次）**

```powershell
gh auth login
```

选 GitHub.com → HTTPS → Login with browser。

**2. 推送并打开 Vercel**

```powershell
cd C:\Users\LENOVO\Desktop\Firefly-master
gh repo create firefly-blog --public --source=. --remote=origin --push
```

然后浏览器打开：**https://vercel.com/new**  
→ Import 刚建的 `firefly-blog` 仓库 → Deploy（框架会自动识别 Astro）  
→ 得到 `https://firefly-blog-xxx.vercel.app`

或运行项目里的 **`一键部署.ps1`**（会先 `gh auth login` 再推送）。

### 同局域网的人先访问（不用上线）

你电脑上已可预览：**http://localhost:4321**  
同一 WiFi 的别人访问：**http://你的电脑IP:4321**（需在防火墙放行 4321 端口）。

## 上线后

把 `src/config/siteConfig.ts` 里的 `site_url` 改成你的 Vercel 地址，再提交一次让 Vercel 自动重新部署。
