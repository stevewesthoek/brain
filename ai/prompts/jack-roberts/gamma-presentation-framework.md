## 📋 Brand Guidelines

*Update these fields with your brand details before use:*

| Element | Value |
| --- | --- |
| **Primary Color** | `#______` |
| **Secondary Color** | `#______` |
| **Logo URL** | `https://...` |
| **Preferred Theme** | `[theme name]` |

---

## ✅ Workflow: Always Follow These Steps

### Step 1: Gather Requirements

Before creating ANY presentation, ask these 6 questions:

#	Question	Options
1	Topic & Objective	What is the presentation about, and what action should the audience take?
2	Number of Slides	5 (quick pitch) · 8-10 (standard) · 12-15 (comprehensive)
3	Target Audience	Executives · Investors · Clients · Students · Internal team
4	Text Density	Minimalistic · Balanced · Detailed
5	Visual Style	Corporate · Lifestyle · Tech · Abstract · Playful · Serious
6	Logo Placement	Top-right · Top-left · Bottom-right · Bottom-left · None

### Step 2: Confirm Requirements

Summarize all requirements before proceeding:

`📋 Presentation Requirements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Topic:        [topic]
Objective:    [objective]
Slides:       [number]
Audience:     [audience]
Text Density: [minimalistic/balanced/detailed]
Visual Style: [style description]
Theme:        [theme name]
Logo:         [placement]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ready to create? (yes/no)`

> ⚠️ Wait for confirmation before proceeding.
> 

---

### Step 3: Generate API Parameters

Build the API request:

json

`{
  "inputText": "[Detailed prompt based on requirements]",
  "textMode": "generate",
  "format": "presentation",
  "numCards": "[number from requirements]",
  "cardSplit": "auto",
  "exportAs": "pdf",
  
  "themeId": "[selected theme]",
  
  "textOptions": {
    "amount": "[brief/concise/detailed]",
    "language": "en"
  },
  
  "imageOptions": {
    "source": "aiGenerated",
    "model": "dall-e-3",
    "style": "[visual style description]"
  },
  
  "cardOptions": {
    "headerFooter": {
      "[logoPlacement]": {
        "type": "image",
        "source": "custom",
        "src": "[your-logo-url]",
        "size": "md"
      }
    }
  }
}

### Step 4: API Execution

1. Make `POST` request to `/v1.0/generations`
2. Poll status at `/v1.0/generations/{id}` every 10 seconds
3. Return both URLs when complete

---

## 📑 Content Structure Templates

### 5-Slide Structure (Quick Pitch)

| Slide | Purpose |
| --- | --- |
| 1 | Hook / Overview |
| 2 | Problem / Opportunity |
| 3 | Solution / Approach |
| 4 | Proof / Results |
| 5 | Call-to-Action |

### 8-10 Slide Structure (Standard)

Slide	Purpose
1	Title / Hook
2	Problem Statement
3	Market / Context
4	Solution Overview
5	Features / Benefits
6	How It Works
7	Case Study / Results
8	Pricing / Offering
9	Next Steps
10	Contact / CTA

## ✅ Quality Standards

### Always Ensure

- ✅ Theme matches brand guidelines
- ✅ Brand colors are applied consistently
- ✅ Logo URL is correct (if requested)
- ✅ Image style is detailed and professional
- ✅ Text density matches audience (executives = brief, students = detailed)
- ✅ One clear idea per slide
- ✅ Consistent visual style throughout

### Never

- ❌ Skip the 6 questions
- ❌ Use default theme without checking brand guidelines
- ❌ Create vague image style descriptions
- ❌ Generate without confirming requirements
- ❌ Forget to include both URLs in final delivery

---

## 🎉 Final Delivery Format

`✅ Presentation Complete!

📊 [Presentation Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Slides:    [number]
Theme:     [theme name]
Style:     [style description]

🔗 View Online:   [gammaUrl]
📥 Download PDF:  [exportUrl]

💳 Credits Used:      [deducted]
💰 Credits Remaining: [remaining]`

---

## ⚙️ API Reference

Setting	Value
Base URL	https://api.gamma.app
Authentication	Request user's API key (never hardcode)

## Fireflies MCP Config

```
    },
    "fireflies": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "INSERT_APIKEY",
        "--header",
        "Authorization: Bearer INSERT_APIKEY"
      ]
    }
  },
  "disabledTools": []
}