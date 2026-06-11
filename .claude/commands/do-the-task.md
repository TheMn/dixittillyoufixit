---
description: Start or resume a Dixit project session — reads CLAUDE.md + TASKS.md, identifies the active task, and waits for confirmation before writing any code.
allowed-tools: Read, Edit, TodoWrite
---

You are starting a session on the Dixit Telegram Bot project. Follow this protocol **exactly**:

**Step 1 — Load context**
Read these two files fully:
- `CLAUDE.md` (project rules, architecture, non-negotiables)
- `TASKS.md` (task tracker with statuses)

**Step 2 — Identify the target task**
- If $ARGUMENTS is a number (e.g. `4`), target **Task $ARGUMENTS**.
- Otherwise, find the **first task that is NOT marked ✅ Done**.

**Step 3 — Announce**
State exactly:
> "I am working on **Task [N]: [title]**. Status: [current status]."
Then give a 2–3 sentence summary of what the task involves and which tests it requires.

**Step 4 — Ask**
Ask the user:
> "Would you like to **start / continue** this task, or jump to a different one?"

**Step 5 — Wait**
Stop. Do not write any code, create any files, or make any edits until the user explicitly confirms.

---

**Standing rules (always apply, every session):**
- When the user confirms starting a task → mark it `🔄 In Progress` in `TASKS.md`
- Mark a task `✅ Done` only **after all its tests pass**
- Never move to the next task automatically — always ask first
- Every feature ships with tests — tests are part of the definition of done
