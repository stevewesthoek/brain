Daily Growth Command System

Command

/daily-growth

Purpose

This command generates a complete daily distribution package based on topics found in:

keyword-topic-engine.md

The AI must:
	1.	choose a high-value keyword/topic
	2.	generate a blog post
	3.	generate social content
	4.	generate comment templates
	5.	generate reply templates

The goal is maximum exposure from minimal effort.

⸻

## Audience Guardrails (Hard Requirements)

Primary audience: non-dev founders using AI/no-code/low-code who want to build SaaS without technical overwhelm.

Tone: practical, reassuring, motivational, founder-first. No developer jargon unless explained in one sentence.

Technicality limit:
- Assume reader cannot code.
- Avoid code snippets entirely.
- Avoid framework deep-dives (Next.js, Prisma, webhooks) unless used as a simple analogy.
- Prefer plain-language concepts: “logins”, “payments”, “data”, “security”, “reliability”, “handoffs”, “automation”.

Content must focus on:
- fears, doubts, shiny-object syndrome
- what to do next
- decision frameworks
- common founder mistakes
- checklists founders can use

Output quality gate (must pass):
- If a paragraph contains more than 2 technical terms, rewrite it in founder language.
- Every piece must contain: 1 story/analogy + 1 checklist + 1 clear “next step”.

⸻

## Topic Scoring (choose the highest score)
Score each candidate 0–5:
- Founder relevance (0–5)
- Search intent (0–5)
- Emotional resonance (fear/doubt/clarity) (0–5)
- Discussion potential (0–5)
Pick the top scoring topic.


Step 1 — Topic Selection

The AI must scan:

keyword-topic-engine.md

and select a topic that meets these conditions:

Priority rules:

1. high search intent
2. evergreen topic
3. relevant to SaaS builders or AI founders
4. discussion-worthy on social media

Output:

Topic:
SEO keyword:
Blog title:
Social hook:

Example:

Topic: AI-generated SaaS failures
SEO keyword: why ai generated code breaks
Blog title: Why AI-Generated SaaS Apps Break in Production
Social hook: AI writes code fast, but SaaS still breaks in production


⸻

Step 2 — Blog Article Generation

Generate a blog post with structure:

Title
Introduction
Main insight
Practical lessons
Conclusion

Requirements:

800–1200 words
problem → explanation → solution
natural tone
no marketing language

Blog article requirements (Founder Edition):
- 900–1400 words
- Written for non-dev founders
- No code, no libraries, no APIs explained in depth
- Use examples like: "login", "payments", "emails", "data backups"
- Include:
  1) “What can go wrong” section (fear)
  2) “Simple plan” section (clarity)
  3) “Checklist” section (action)

Blog posts are the source content.

All social content derives from them.

⸻

Step 3 — LinkedIn Content

Generate:

1 LinkedIn post

Structure:

Hook
Insight
Short explanation
Question

Example structure:

AI can generate code incredibly fast now.

But most SaaS products don’t fail because of missing code.

They fail because of infrastructure.

Auth.
Billing.
Deployment.
Environment variables.

Curious if other builders are seeing the same pattern.


⸻

LinkedIn Comment Templates

Generate 3 comments that can be posted on large posts.

Structure:

Observation
Insight
Question


⸻

Step 4 — X Content

Generate:

1 insight post
1 mini thread
5 reply comments

Insight Post

1–3 sentences.

Example:

AI writes code fast.

But SaaS products rarely fail because of missing code.

They fail because infrastructure breaks.


⸻

Thread Structure

Tweet 1 — Hook
Tweet 2–4 — Insight
Tweet 5 — Lesson


⸻

Reply Comments

Short replies for discussions.

Example:

Interesting shift.

AI tools accelerate coding, but architecture decisions are becoming even more important.


⸻

Step 5 — Reddit Content

Generate:

1 Reddit discussion post
3 helpful comment templates

Reddit Post Structure

Problem
Explanation
Discussion question

Example:

AI can generate code extremely fast now.

But something interesting is happening.

Many SaaS products fail when they reach production.

Auth systems, billing logic, and deployment setups still require careful thinking.

Curious if other builders are seeing the same thing.


⸻

Step 6 — Comment Pyramid Kit

Generate comments for visibility.

Output:

3 LinkedIn comments
3 X replies
3 Reddit comments

These should be:

insightful
non-promotional
discussion-oriented


⸻

Step 7 — Reply Templates

Generate conversation replies.

These are used when people respond to posts.

Output:

5 thoughtful replies

Example:

That’s an interesting point.

I’ve noticed something similar where AI speeds up coding but makes architectural thinking more important.

Curious how your team approaches that balance.


⸻

Final Output Format

When /daily-growth runs, the AI must produce:

TOPIC
SEO KEYWORD
BLOG TITLE

BLOG ARTICLE

LINKEDIN POST
3 LINKEDIN COMMENTS

X POST
X THREAD
5 X REPLIES

REDDIT POST
3 REDDIT COMMENTS

5 REPLY TEMPLATES


⸻

Execution Workflow

Daily workflow becomes:

Morning:

run /daily-growth

Then:

publish blog
post LinkedIn
post X insight
comment on posts

Total manual time:

20–30 minutes


⸻

Weekly Compounding

Each blog post becomes:

1 blog article
1 LinkedIn post
1 Reddit discussion
6+ X posts
10+ comments

That is ~20 distribution points per week from one idea.

⸻

Key Principle

This system works because:

SEO captures search
LinkedIn builds authority
Reddit creates discussion
X creates visibility

Together they compound.