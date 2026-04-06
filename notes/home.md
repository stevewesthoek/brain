---
type: dashboard
---

# Command Center

> The single place to start every day. Everything else lives one click away.

---

## 🔴 Overdue

```tasks
not done
due before today
sort by due
limit 5
```

---

## 📅 Today

```tasks
not done
due today
sort by priority
```

---

## ⚡ Active Projects

```dataview
TABLE status, phase, priority, file.mtime AS "Updated"
FROM "notes/projects"
WHERE type = "project" AND status = "active"
SORT priority ASC, file.mtime DESC
```

---

## 📥 Inbox  *(unprocessed)*

```dataview
LIST file.mtime AS "Captured"
FROM "notes/inbox"
WHERE file.name != ".gitkeep"
SORT file.mtime DESC
LIMIT 10
```

---

## 🗓 Upcoming  *(next 7 days)*

```tasks
not done
due after today
due before in 7 days
sort by due
limit 10
```

---

## 📊 All Projects by Phase

```dataview
TABLE status, phase, area
FROM "notes/projects"
WHERE type = "project"
SORT phase ASC, status ASC
```

---

## 🗄 Areas

```dataview
LIST
FROM "notes/areas"
WHERE type = "area"
SORT file.name ASC
```

---

*→ [[kanban|Kanban Board]]  ·  [[strategy|Strategy]]  ·  [[notes/inbox/|Inbox]]*
