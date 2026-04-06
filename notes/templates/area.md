---
type: area
status: active
created: {{date:YYYY-MM-DD}}
tags:
---

# {{title}}

## Purpose
*Why does this area exist in your life? What does "well maintained" look like here?*

---

## Standards
*What are you maintaining? What's the bar you're holding yourself to?*

- 
- 

---

## Active Projects in This Area

```dataview
LIST phase
FROM "notes/projects"
WHERE area = this.file.name AND status = "active"
```

---

## Open Tasks

```tasks
not done
tags include #area/{{title}}
sort by priority
```

---

## Notes

*Ongoing observations, insights, things to remember.*

---

*→ [[home|Command Center]]  ·  [[strategy|Strategy]]*
