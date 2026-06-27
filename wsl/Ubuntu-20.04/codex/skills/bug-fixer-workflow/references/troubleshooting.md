# 故障排查指南

本文档提供常见问题的解决方案。

## 配置前提

在执行任何依赖 Redmine 的脚本前，先确认：

```bash
cp .bugfix-config.example.json .bugfix-config.json
```

然后在 `.bugfix-config.json` 中填写你自己的 Redmine 地址和账号。真实凭据只能保留在本地配置文件中，不能写进脚本、技能说明或参考文档。

## 常见错误和解决方案

### 错误 1: "Workspace not initialized"

**症状**：
```
Workspace not initialized
Run: ./scripts/batch_fetch.sh
```

**原因**：工作空间未初始化

**解决方案**：
```bash
./scripts/batch_fetch.sh
```

**预防**：每天开始工作前运行一次 `batch_fetch.sh`

---

### 错误 2: "Current issue not set"

**症状**：
```
Current issue not set
Use: ./scripts/quick_start.sh <ISSUE_ID>
```

**原因**：没有设置当前工作的问题

**解决方案**：
```bash
./scripts/quick_start.sh 21626
```

---

### 错误 3: "bug-fixer-workflow scripts not found"

**症状**：
```
✗ bug-fixer-workflow scripts not found
```

**原因**：bug-fixer-workflow skill 未安装或路径错误

**解决方案**：
1. 检查 skill 是否存在：
```bash
ls -la ./scripts/
```

2. 如果不存在，需要先安装 bug-fixer-workflow skill

3. 如果存在但路径不对，修改脚本中的路径：
```bash
# 在脚本顶部修改
BUGFIX_SKILL=".."
```

---

### 错误 4: "Branch already exists"

**症状**：
```
Branch fix/issue-21626 already exists
Switch to existing branch? (y/n)
```

**原因**：该问题已经创建过分支

**解决方案**：

**选项 A**: 切换到现有分支
```bash
git checkout fix/issue-21626
```

**选项 B**: 删除旧分支，重新创建
```bash
git branch -D fix/issue-21626
./scripts/quick_start.sh 21626
```

---

### 错误 5: "Uncommitted changes"

**症状**：
```
Uncommitted changes
Please commit or stash changes
```

**原因**：当前分支有未提交的更改

**解决方案**：

**选项 A**: 暂存更改
```bash
git stash
./scripts/quick_start.sh 21626
# ... 完成工作后 ...
git stash pop
```

**选项 B**: 提交更改
```bash
git add .
git commit -m "WIP: saving work"
./scripts/quick_start.sh 21626
```

---

### 错误 6: "Build failed"

**症状**：
```
✗ Build failed
Please fix build errors before completing issue
```

**原因**：代码编译失败

**解决方案**：
```bash
# 手动运行构建查看详细错误
pnpm build

# 修复错误后重新完成
./scripts/quick_complete.sh 21626 "修复描述"
```

---

### 错误 7: "No changes detected"

**症状**：
```
No changes detected
Continue anyway? (y/n)
```

**原因**：没有文件修改，可能在错误的分支

**解决方案**：
1. 检查当前分支
```bash
git branch --show-current
git status
```

2. 如果确实没有修改，选择 `y` 继续更新状态即可

3. 如果在错误的分支，切换到正确的分支

---

### 错误 8: "jq: command not found"

**症状**：
```
jq: command not found
Install jq: https://stedolan.github.io/jq/
```

**原因**：系统缺少 jq 工具

**解决方案**：

**Windows (Chocolatey)**:
```bash
choco install jq
```

**Linux/Mac**:
```bash
brew install jq
# 或
sudo apt-get install jq
```

---

### 错误 9: "API rate limit"

**症状**：API 调用被限流

**原因**：短时间内请求过多

**解决方案**：脚本已内置重试机制，会自动处理。如果持续失败，等待几分钟后重试。

---

### 错误 10: "Git commit failed"

**症状**：提交代码失败

**原因**：可能是配置问题或权限问题

**解决方案**：
```bash
# 检查 git 配置
git config user.name
git config user.email

# 检查 git 状态
git status

# 手动提交查看详细错误
git add .
git commit -m "test"
```

---

## 调试技巧

### 启用详细日志

在脚本开头添加：
```bash
set -x  # 启用调试模式
set -v  # 显示执行的命令
```

### 查看脚本输出

```bash
# 保存输出到文件
./scripts/quick_start.sh 21626 2>&1 | tee debug.log
```

### 手动执行步骤

当脚本失败时，可以手动执行各个步骤来定位问题：

```bash
# 1. 手动调用 API
curl -u "<redmine-username>:<redmine-password>" \
  "<redmine-base-url>/issues/21626.json?include=attachments"

# 2. 手动创建分支
git checkout -b fix/issue-21626

# 3. 手动提交
git add .
git commit -m "test commit"
```

---

## 环境检查

### 检查所有依赖

```bash
# 检查必要工具
echo "Checking dependencies..."
which jq && echo "✓ jq installed" || echo "✗ jq missing"
which git && echo "✓ git installed" || echo "✗ git missing"
which curl && echo "✓ curl installed" || echo "✗ curl missing"

# 检查 skill 文件
echo ""
echo "Checking skills..."
[ -f "./scripts/get_task_context.mjs" ] && \
  echo "✓ bug-fixer-workflow scripts installed" || \
  echo "✗ bug-fixer-workflow scripts missing"

# 检查工作空间
echo ""
echo "Checking workspace..."
[ -d "workspace" ] && \
  echo "✓ workspace initialized" || \
  echo "✗ workspace not initialized"
```

---

## 恢复流程

如果遇到无法解决的问题，可以重置工作空间：

```bash
# 1. 备份当前工作（如果有重要数据）
cp -r workspace workspace.backup.$(date +%Y%m%d)

# 2. 清理工作空间
rm -rf workspace

# 3. 重新初始化
./scripts/batch_fetch.sh

# 4. 恢复未完成的工作
./scripts/progress_restore.sh
```

---

## 获取帮助

如果以上方案都无法解决问题：

1. 检查脚本版本
2. 查看 git 历史是否有相关修复
3. 提交详细的错误报告
   - 错误信息
   - 运行的命令
   - 环境信息（OS、Shell版本等）
   - 调试日志（如果启用了）
