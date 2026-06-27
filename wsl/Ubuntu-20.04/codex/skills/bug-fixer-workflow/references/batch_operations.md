# 批量操作指南

本文档说明如何使用 bug-fixer-workflow skill 进行批量操作。

## 批量获取任务

### 初始化工作空间

每天开始工作前运行一次：

```bash
./scripts/batch_fetch.sh
```

**输出**：
- `workspace/tasks.json` - 所有任务数据
- `workspace/priority_list.txt` - 优先级列表
- `workspace/status_summary.txt` - 状态汇总
- `workspace/issues/<id>/` - 各问题工作空间
- `workspace/issues/<id>/attachments/` - 预下载的附件

---

## 批量开始多个问题

### 场景：处理一批相似问题

```bash
# 获取要处理的问题列表
cat workspace/priority_list.txt

# 批量开始（按顺序）
for issue_id in 21626 21627 21628; do
  ./scripts/quick_start.sh $issue_id
done
```

### 场景：并行处理独立问题

如果问题之间完全独立，可以并行处理：

```bash
# 同时开始多个问题（在不同终端）
# 终端 1:
./scripts/quick_start.sh 21626

# 终端 2:
./scripts/quick_start.sh 21627

# 终端 3:
./scripts/quick_start.sh 21628
```

---

## 批量完成修复

### 场景：统一解决方案

```bash
# 批量完成（相同解决说明）
for issue_id in 21626 21627 21628; do
  ./scripts/quick_complete.sh $issue_id "统一修复：参数验证逻辑优化"
done
```

### 场景：各自不同的解决方案

```bash
# 从文件读取问题ID和对应解决说明
while read issue_id resolution; do
  ./scripts/quick_complete.sh $issue_id "$resolution"
done < batch_resolutions.txt
```

**batch_resolutions.txt 格式**：
```
21626 修复动态范围参数验证逻辑
21627 优化颜色模块默认值设置
21628 完善无线绑定错误提示
```

---

## 批量提交代码

### 提交所有修复

```bash
./scripts/batch_commit.sh
```

**功能**：
- 扫描所有有未推送提交的分支
- 显示提交预览
- 确认后批量推送
- 生成推送报告

### 选择性提交

```bash
# 只提交特定问题
ISSUES="21626 21627"

for issue_id in $ISSUES; do
  branch=$(cat workspace/issues/$issue_id/branch.txt)
  echo "Pushing $branch..."
  git push origin "$branch"
done
```

---

## 批量更新状态

### 场景：统一更新为"已解决"状态

```bash
# 批量更新多个问题为"已解决"状态
for issue_id in 21626 21627 21628; do
  node scripts/update_redmine.mjs \
    "$issue_id" "已完成修复" "等待测试验证" "0 天 1 时" >/dev/null 2>&1
  echo "✓ Issue #$issue_id updated to Resolved"
done
```

### 场景：批量标记已验证的问题为已解决

```bash
# 批量标记多个已验证问题为已解决
for issue_id in 21626 21627 21628; do
  node scripts/update_redmine.mjs \
    "$issue_id" "已验证修复" "关闭问题并记录验证结果" "0 天 1 时" >/dev/null 2>&1
  echo "✓ Issue #$issue_id marked as resolved"
done
```

---

## 批量下载附件

### 下载所有任务的附件

```bash
# 在 batch_fetch.sh 中自动完成
# 或者手动执行：

for issue_dir in workspace/issues/*; do
  issue_id=$(basename "$issue_dir")
  node scripts/fetch_issue_info.mjs \
    "$issue_id" >/dev/null 2>&1
  echo "✓ Downloaded attachments for #$issue_id"
done
```

---

## 批量生成报告

### 每日汇总

```bash
./scripts/generate_summary.sh --today
```

### 每周汇总

```bash
./scripts/generate_summary.sh --week
```

### 全部历史

```bash
./scripts/generate_summary.sh --all
```

---

## 批量清理

### 清理已合并分支

```bash
# 查看已合并的本地分支
git branch --merged | grep fix/issue-

# 删除已合并的本地分支
git branch --merged | grep fix/issue- | xargs git branch -d

# 删除已合并的远程分支
git branch --merged | grep fix/issue- | while read branch; do
  git push origin --delete "$branch"
done
```

### 清理旧的工作空间

```bash
# 清理超过 30 天的问题目录
find workspace/issues -type d -mtime +30 -exec rm -rf {} +
```

---

## 批量工作流示例

### 完整的批量处理流程

```bash
#!/bin/bash
# batch_process.sh - 批量处理相似问题

# 1. 初始化
./scripts/batch_fetch.sh

# 2. 获取要处理的问题列表
ISSUES="21626 21627 21628"

# 3. 批量开始
for issue_id in $ISSUES; do
  ./scripts/quick_start.sh $issue_id
done

# 4. 逐个修复（这里需要手动）
echo "请在各自分支中修复代码..."
echo "修复完成后按 Enter 继续"
read

# 5. 批量完成
for issue_id in $ISSUES; do
  ./scripts/quick_complete.sh $issue_id "批量修复：统一的参数验证逻辑"
done

# 6. 批量推送
./scripts/batch_commit.sh

# 7. 生成汇总
./scripts/generate_summary.sh --today
```

---

## 性能优化建议

### 1. 并行操作

利用终端的多标签页功能，同时处理多个独立问题。

### 2. 批量操作

将相似问题归类后批量处理，减少重复性操作。

### 3. 定期清理

定期清理已合并分支和旧工作空间，保持整洁。

### 4. 使用快捷命令

创建 shell 别名或函数来简化常用操作：

```bash
# 在 ~/.bashrc 或 ~/.bash_profile 中添加

alias bf-start='./scripts/quick_start.sh'
alias bf-complete='./scripts/quick_complete.sh'
alias bf-status='./scripts/show_current.sh'
alias bf-commit='./scripts/batch_commit.sh'

# 函数：批量完成当前分支的所有问题
bf-complete-all() {
  CURRENT=$(git branch --show-current)
  ISSUE_ID=$(echo $CURRENT | grep -oP 'issue-\K\d+')
  if [ -n "$ISSUE_ID" ]; then
    ./scripts/quick_complete.sh $ISSUE_ID "$1"
  else
    echo "Not on an issue branch"
  fi
}
```
