# Firefly 一键部署到 Vercel（需先登录一次）
# 用法：在 PowerShell 里运行 .\一键部署.ps1

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;C:\Program Files\nodejs;$env:APPDATA\npm;" + $env:Path

Set-Location $PSScriptRoot

Write-Host ">>> 1/4 构建网站..." -ForegroundColor Cyan
npm run build

Write-Host ">>> 2/4 检查 GitHub 登录..." -ForegroundColor Cyan
gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "请先登录 GitHub（浏览器会打开）：" -ForegroundColor Yellow
    gh auth login -h github.com -p https -w
}

Write-Host ">>> 3/4 推送到 GitHub（仓库名 firefly-blog，可改）..." -ForegroundColor Cyan
$repo = "firefly-blog"
if (-not (Test-Path .git)) {
    git init
    git add -A
    git -c user.name="Firefly Deploy" -c user.email="deploy@local" commit -m "Initial commit: Firefly blog"
}
$exists = gh repo view "LENOVO/$repo" 2>$null
if ($LASTEXITCODE -ne 0) {
    gh repo create $repo --public --source=. --remote=origin --push
} else {
    git push -u origin main 2>$null
    if ($LASTEXITCODE -ne 0) { git push -u origin master }
}

Write-Host ">>> 4/4 部署到 Vercel..." -ForegroundColor Cyan
npx vercel@latest deploy --prod --yes

Write-Host ""
Write-Host "完成。终端里会显示 https://xxx.vercel.app 就是你的网址。" -ForegroundColor Green
