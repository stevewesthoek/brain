# Optional Feature README Template

Use this template only when shipping a new optional module on top of ProKit. Do not apply it to the core boilerplate.

## Overview

- Feature name:
- Project name:
- One-line pitch:

## Setup

```bash
npm install
npm run db:init -- --slug <normalized-slug>
npm run db:migrate:dev
npm run dev
```

`<normalized-slug>` rule:
- Start from the repo name.
- Lowercase it.
- Remove `-`, `_`, and `.` so it becomes one word.
- Use this same value for `APP_SLUG`, tenant schema, and tenant user naming.

## Required environment variables

List only the variables that differ from the core ProKit README.

## Routes and APIs

List the routes this module adds or overrides.

## Data model

List any new Prisma models or fields.

## Deployment notes

Call out any production steps that differ from standard ProKit deployment.
