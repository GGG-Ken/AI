# 优化的 Bug 修复工作流程

本文档详细说明了使用 Redmine API 后的优化工作流程。

## 传统流程 vs 优化流程

### 传统流程（浏览器或人工验证驱动）

```
1. 打开浏览器 → 登录 Redmine (10-20秒)
2. 导航到任务页面
3. 手动修改状态为"进行中"
4. 复制问题信息
5. 访问测试环境复现，或收集设备/运行时失败证据
6. 分析代码定位问题
7. 编写修复代码
8. 编译测试
9. 打开浏览器 → 填写解决信息 (10-20秒)
10. 手动提交代码

总耗时: ~30-60分钟/问题
```

### 优化流程（使用 Redmine API）

```
预处理阶段（一次性，~5秒）:
1. batch_fetch.sh - 批量获取所有任务
2. 自动下载所有附件
3. 生成本地任务列表

修复阶段（每个问题，~1秒API调用）:
1. quick_start.sh <ID> - 一键开始
   - 更新状态（<1秒）
   - 显示详细信息
   - 下载附件（并行）
   - 创建分支
2. 访问测试环境复现，或获取设备/日志/抓包等失败证据
3. 分析代码定位问题
4. 编写修复代码
5. 编译测试
6. quick_complete.sh <ID> - 一键完成
   - 提交代码
   - 更新状态（<1秒）
   - 填写解决信息

批量提交阶段:
1. batch_commit.sh - 批量推送
2. generate_summary.sh - 生成汇总

总耗时: ~10-20分钟/问题（节省 60-70%）
```

## 关键优化点

### 1. 批量预处理

**传统方式**：每次访问 Redmine 都需要浏览器操作

**优化方式**：一次性获取所有数据到本地
- 使用 `batch_fetch.sh` 初始化
- 本地缓存任务信息
- 并行下载所有附件

**收益**：节省 90% 的 Redmine 访问时间

### 2. 并行附件下载

**传统方式**：逐个手动下载，每次需要页面操作

**优化方式**：使用 API 并行下载
- 后台并行执行
- 自动创建目录结构
- 进度显示

**收益**：节省 80% 的附件下载时间

### 3. 一键操作

**传统方式**：多个手动步骤，容易出错

**优化方式**：脚本封装
- `quick_start.sh` - 一键开始
- `quick_complete.sh` - 一键完成
- `batch_commit.sh` - 批量推送

**收益**：减少人为错误，提高效率

### 4. 结构化数据

**传统方式**：从 HTML 解析数据

**优化方式**：API 返回 JSON
- jq 处理
- 类型安全
- 易于扩展

**收益**：数据处理更快更可靠

### 5. 进度管理

**传统方式**：无进度跟踪

**优化方式**：自动保存/恢复
- `progress_save.sh`
- `progress_restore.sh`
- 断点续传

**收益**：工作不丢失，可随时恢复

## 工作空间管理

### 目录结构说明

```
workspace/
├── tasks.json           # 所有任务的完整数据（只读缓存）
├── priority_list.txt    # 按优先级排序的任务列表
├── status_summary.txt   # 状态统计汇总
├── current_issue.txt    # 当前正在处理的问题ID
├── progress.json        # 工作进度状态
├── issues/              # 各问题的工作空间
│   ├── 21626/
│   │   ├── info.json       # 问题详细信息
│   │   ├── attachments/    # 该问题的附件
│   │   ├── fixes/          # 修复代码
│   │   └── branch.txt      # Git 分支名
│   └── 21627/
├── logs/                # 操作日志
└── reports/             # 生成的报告
```

### 工作空间生命周期

1. **初始化**（每天一次）
   ```bash
   ./scripts/batch_fetch.sh
   ```

2. **工作循环**（重复每个问题）
   ```bash
   ./scripts/quick_start.sh 21626
   # ... 修复代码 ...
   ./scripts/quick_complete.sh 21626 "修复描述"
   ```

3. **批量操作**（每天结束）
   ```bash
   ./scripts/batch_commit.sh
   ./scripts/generate_summary.sh --today
   ./scripts/progress_save.sh
   ```

4. **中断恢复**（随时）
   ```bash
   ./scripts/progress_restore.sh
   ```

## 分支管理策略

### 命名规范

```
fix/issue-<ISSUE_ID>
```

**示例**：
- `fix/issue-21626`
- `fix/issue-21627`
- `fix/issue-21628`

### 分支生命周期

1. **创建** - 由 `quick_start.sh` 自动创建
2. **工作** - 在分支上进行修复
3. **提交** - 由 `quick_complete.sh` 提交
4. **推送** - 由 `batch_commit.sh` 推送
5. **合并** - 手动合并到主分支
6. **删除** - 手动删除已合并分支

### 分支切换

```bash
# 查看所有问题分支
git branch | grep fix/issue-

# 切换到指定问题分支
git checkout fix/issue-21626

# 查看当前分支
git branch --show-current
```

## 常见问题场景

### 场景 1: 每日例行工作

```bash
# 早上开始
./scripts/batch_fetch.sh

# 查看任务
cat workspace/priority_list.txt

# 开始处理第一个问题
./scripts/quick_start.sh 21626

# ... 修复代码 ...

# 完成修复
./scripts/quick_complete.sh 21626 "完成代码修复，待目标环境验证"

# 继续下一个
./scripts/quick_start.sh 21627
```

### 场景 2: 处理相似问题

```bash
# 同时启动多个问题
for id in 21626 21627 21628; do
  ./scripts/quick_start.sh $id
done

# 逐个修复（可能共享代码）
# ... 修复代码 ...

# 批量完成
for id in 21626 21627 21628; do
  ./scripts/quick_complete.sh $id "统一修复方案"
done

# 批量推送
./scripts/batch_commit.sh
```

### 场景 3: 工作中断

```bash
# 保存进度
./scripts/progress_save.sh

# ... (系统关闭、上下文切换) ...

# 恢复工作
./scripts/progress_restore.sh

# 继续完成
./scripts/quick_complete.sh 21626 "继续完成"
```

### 场景 4: 紧急问题

```bash
# 跳过批量获取，直接开始
./scripts/quick_start.sh 21626

# 快速修复
# ... 紧急修复 ...

# 立即完成
./scripts/quick_complete.sh 21626 "紧急修复"
```

## 最佳实践

### 1. 每日例行

- 早上运行 `batch_fetch.sh` 刷新数据
- 使用 `priority_list.txt` 规划工作顺序
- 晚上运行 `batch_commit.sh` 提交所有
- 运行 `generate_summary.sh --today` 生成日报

### 2. 代码质量

- 每次完成前确保 `pnpm build` 通过
- 提交前检查相关文件
- 避免在一个分支中混合多个问题

### 3. 分支管理

- 一个分支对应一个问题
- 分支名称保持一致性
- 及时清理已合并分支

### 4. 进度管理

- 工作中断前运行 `progress_save.sh`
- 恢复工作后运行 `progress_restore.sh`
- 定期检查 `workspace/current_issue.txt`

### 5. 团队协作

- 统一使用 skill 的脚本
- 遵循分支命名规范
- 提交信息遵循模板格式

## 性能指标

### 时间对比

| 操作 | 传统方式 | 优化方式 | 提升 |
|------|---------|---------|------|
| 修改状态 | 20秒 | 1秒 | 95% |
| 获取详情 | 15秒 | 1秒 | 93% |
| 下载附件 | 10秒/个 | 2秒/个 | 80% |
| 填写解决 | 30秒 | 5秒 | 83% |
| **单问题总时间** | ~75秒 | ~9秒 | **88%** |

### 批量操作优势

| 操作 | 传统方式 | 优化方式 | 提升 |
|------|---------|---------|------|
| 10个问题 | ~750秒 | ~50秒 | 93% |
| 50个附件 | ~500秒 | ~30秒 | 94% |
| 10个提交 | 需要手动 | 自动化 | 95% |
