# Project Onboarding Split

## Purpose

Define the standard boundary between a project repo and the shared Video Orchestrator in `brain`.

This document is the default reference for any new project that wants to delegate media generation to the Brain Core API without duplicating the shared pipeline.

## Core Split

### Project repo owns

- Project-specific admin UI
- Episode selection and content entry
- Project-specific template choice
- Editorial decisions and approval flow
- Project-specific assets and brand context
- Display of generated results

### Brain repo owns

- Video Orchestrator execution
- Shared thumbnail rendering
- Shared audio, subtitle, composition, metadata, and posting pipelines
- Shared validation and job orchestration
- Shared artifact storage contracts
- Shared API surface used by all projects

## Standard Workflow

1. User works in the project admin panel.
2. The project repo packages a job request.
3. The project repo calls the Brain Core API.
4. The Video Orchestrator runs the shared pipeline.
5. The Brain Core API returns job status and artifact references.
6. The project admin panel renders or links the results.

## Thumbnail Rule

Thumbnail design follows the same split:

- The project admin panel remains the operator interface.
- The shared Video Orchestrator does the actual rendering and variant generation.
- The project repo must not reimplement the shared renderer once the shared path is proven.

## Migration Rule

Never cut over a project repo until all of these are true:

- The Brain Core API can accept the project request shape.
- The shared pipeline produces matching outputs.
- The project admin panel can read the returned artifacts or job status.
- The existing project-local path remains available as fallback until validation passes.

## Standard Contract

Every project onboarding should define:

- `project_id`
- source episode or content payload
- target platforms
- template ids
- approval policy
- artifact return shape
- fallback behavior
- rollback behavior

## Admin Dashboard Pattern

The admin dashboard for each project should be normalized, not reinvented:

- job creation form
- template selector
- preview/status panel
- artifact gallery
- approval actions
- publish or sync actions

Keep the layout and interaction model consistent across repos so operators do not relearn the workflow for each project.

## Non-Goals

- Do not move project strategy into Brain.
- Do not duplicate the shared renderer in each repo.
- Do not migrate a project until the shared API path is verified in production-like conditions.
- Do not rename the Video Orchestrator or the Brain Core API.

## Notes

Use this document as the template for future project onboarding docs.
When a new repo is added, create a project-specific overlay doc that maps its admin UI to the shared Brain Core API contract without changing the shared execution engine.
