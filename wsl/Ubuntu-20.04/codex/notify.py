#!/usr/bin/env python3
import json
import sys
import os
import urllib.request

#FEISHU_WEBHOOK = "https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
FEISHU_WEBHOOK = "https://open.feishu.cn/open-apis/bot/v2/hook/67aea7e7-afe5-4637-9f2d-5c9d436e1746"

# 判断是否运行在 iTerm 中
# Codex 在 iTerm 下会自带系统通知，这里避免重复发送
def running_in_iterm():
    pid = os.getpid()

    while True:
        try:
            ppid = os.popen(f"ps -o ppid= -p {pid}").read().strip()
            if not ppid:
                return False

            pid = int(ppid)
            cmd = os.popen(f"ps -o comm= -p {pid}").read().strip()

            if "iTerm" in cmd:
                return True

            if pid == 1:
                return False
        except Exception:
            return False


EVENT_TITLES = {
    "permission_request": "⚠️ Codex 等待权限确认",
    "confirmation_request": "⚠️ Codex 等待执行确认",
    "user_input_required": "⚠️ Codex 等待用户输入",
    "long_running": "⏳ Codex 仍在处理中",
    "agent-turn-complete": "✅ Codex 已完成",
}


def compact_text(text, limit=72):
    if not text:
        return ""

    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if len(first_line) <= limit:
        return first_line
    return first_line[: limit - 1].rstrip() + "…"


def join_action_target(action, target):
    if not target:
        return action

    if target[0].isascii() and (target[0].isalnum() or target[0] in "._-/"):
        return f"{action} {target}"
    return f"{action}{target}"


def parse_completion_summary(summary):
    prefix_modes = (
        ("已回复", "回答"),
        ("回复了", "回答"),
        ("已完成", "处理"),
        ("完成了", "处理"),
        ("已处理", "处理"),
        ("处理了", "处理"),
        ("已调整", "处理"),
        ("调整了", "处理"),
    )
    text = summary.strip()
    for prefix, mode in prefix_modes:
        if text.startswith(prefix):
            return mode, text[len(prefix):].strip(" ：:，,。")
    return "处理", text


def build_status_line(event_type, last_msg):
    summary = compact_text(last_msg)

    if event_type == "permission_request":
        return f"等待权限确认：{summary}" if summary else "等待权限确认"
    if event_type == "confirmation_request":
        return f"等待执行确认：{summary}" if summary else "等待执行确认"
    if event_type == "user_input_required":
        return f"等待用户输入：{summary}" if summary else "等待用户输入"
    if event_type == "long_running":
        return f"处理中：{summary}" if summary else "处理中"
    if event_type == "agent-turn-complete" or event_type.endswith("complete"):
        action, target = parse_completion_summary(summary)
        subject = join_action_target(action, target)
        return f"{subject}已完成" if target else f"{action}已完成"

    return f"事件：{event_type}" if event_type else (summary or "Codex 通知")


def build_notification_text(title, project, status_line, event_type, last_msg):
    # 完成类事件保留简洁状态行，并在下一行附原始正文内容。
    if event_type == "agent-turn-complete" or event_type.endswith("complete"):
        return f"""{title}
项目：{project}
状态：{status_line}

{last_msg}
"""

    return f"""{title}
项目：{project}
状态：{status_line}

{last_msg}
"""


def main():
    if running_in_iterm():
        return

    args = sys.argv[1:]
    dry_run = False
    if args and args[0] == "--dry-run":
        dry_run = True
        args = args[1:]

    if len(args) < 1:
        return

    # 解析 Codex 传入的事件 JSON
    try:
        event = json.loads(args[0])
    except json.JSONDecodeError:
        return

    cwd = event.get("cwd", "")
    project = os.path.basename(cwd)
    event_type = event.get("type", "")
    last_msg = (
        event.get("last-assistant-message")
        or event.get("message")
        or event.get("summary")
        or ""
    ).strip()
    title = event.get("title") or EVENT_TITLES.get(event_type, "✅ Codex 通知")
    status_line = build_status_line(event_type, last_msg)

    if not project:
        project = cwd or "unknown"

    text = build_notification_text(title, project, status_line, event_type, last_msg)

    payload = {
        "msg_type": "text",
        "content": {
            "text": text
        }
    }

    if dry_run:
        print(text)
        return

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        FEISHU_WEBHOOK,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


if __name__ == "__main__":
    main()
