---
starter_id: next
package_manager: npm
project_name: tripsprint-ai
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

TripSprint AI is a solo, 3-week web-app MVP with auth and AI itinerary generation as the two technology-forcing features. Next.js was chosen over the JS/web recommended default (10x-astro-starter) because the Cloudflare edge runtime's 30-second request timeout sits exactly at the PRD's AI-generation NFR limit with no buffer; Next.js with streaming responses on AI routes is the standard mitigation and keeps Cloudflare Pages as the deployment target. Next.js passes all four agent-friendly quality gates — TypeScript throughout, App Router file-based conventions, the largest React training-data corpus in JS, and current versioned docs — and its bootstrapper confidence is verified, meaning scaffolding will run end-to-end without manual intervention. Auth and AI features are flagged; payments, realtime, and background jobs are out of scope per PRD non-goals. CI runs on GitHub Actions with auto-deploy on merge to main.
