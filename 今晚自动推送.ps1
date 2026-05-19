# 自动重试 git push，成功或你手动关闭窗口后停止
# 日志：同目录 push-log.txt

$ErrorActionPreference = "Continue"
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;C:\Program Files\nodejs;$env:APPDATA\npm;" + $env:Path

Set-Location $PSScriptRoot
$logFile = Join-Path $PSScriptRoot "push-log.txt"

function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    Write-Host $line
}

Write-Log "=== 开始自动推送 hualeide/firefly-blog ==="
Write-Log "仓库: $(git remote get-url origin 2>$null)"

$attempt = 0
$maxAttempts = 200   # 约 200 次 * 10 分钟 ≈ 33 小时

while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Log "--- 第 $attempt 次尝试 ---"

    $out = git -c http.postBuffer=524288000 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999 push -u origin main 2>&1 | Out-String

    if ($LASTEXITCODE -eq 0) {
        Write-Log "推送成功！请到 https://github.com/hualeide/firefly-blog 查看"
        Write-Log "下一步: 打开 https://vercel.com/new 导入该仓库 Deploy"
        [System.Media.SystemSounds]::Asterisk.Play() 2>$null
        break
    }

    Write-Log "失败: $($out.Trim())"
    Write-Log "10 分钟后重试... (可按 Ctrl+C 停止)"
    Start-Sleep -Seconds 600
}

if ($attempt -ge $maxAttempts) {
    Write-Log "已达最大重试次数，请改天用热点/VPN 再试"
}
