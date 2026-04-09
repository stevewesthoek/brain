---
type: dashboard
---

# Command Center

**Check these first. Everything else is reference.**

---

## 🎯 Today's Focus

```dataview
TABLE priority, assigned_to, due_date
FROM "notes/tasks"
WHERE status = "ready" OR status = "in-progress"
AND due_date = dateformat(now, "yyyy-MM-dd")
SORT priority ASC
LIMIT 5
```

---

## ⚠️ Blocked

```dataview
LIST
FROM "notes/tasks"
WHERE status = "blocked"
LIMIT 5
```

**⚠️ If anything here, escalate immediately.**

---

## 📥 Unprocessed Inbox

```dataview
LIST file.mtime
FROM "notes/inbox"
SORT file.mtime DESC
LIMIT 5
```

---

## 🚀 Active Projects

```dataview
LIST status, target_end_date
FROM "notes/projects"
WHERE status = "in-progress"
SORT target_end_date ASC
```

---

## Quick Links

- [[kanban]] — Drag tasks between columns
- [[strategy]] — Strategic decisions
- [[areas]] — Ongoing areas
- STRUCTURE.md — How this works

---

*Last updated: {{date:YYYY-MM-DD HH:mm}}*
