# Repo lockdown (Nov 11, 2026)

Why: on Nov 10–11, 2026 a stolen NEEDcreations GitHub credential (the public
"WF_CTOKEN" / "docs: dependency audit notes" campaign) pushed unsigned
`ci: refresh build cache` / `ci: restore` commit pairs to `gh-pages` that
injected a secret-dumping workflow into `deploy-dev.yml`. Every restore put the
tree back, and no workflow ran on the injected commits, but nothing in the repo
stopped a direct push. This file lists what this PR changes and the settings
only the owner can click.

## What this PR changes
- `.github/CODEOWNERS`: `@NEEDcreations` owns everything, with explicit entries
  for `.github/`, workflows, rules, functions, workers and deploy scripts.
- Every `uses:` in every workflow is pinned to a full commit SHA (tag kept as a
  comment). Tool installs inside steps are pinned too (`wrangler@3.114.17`,
  `pyzipper==0.4.0`).
- Least-privilege tokens: each workflow sets `permissions: {}` and each job asks
  only for what it needs (`deploy.yml`: contents read, pages write, id-token
  write; staging: contents read; R2 backup: none). Checkouts use
  `persist-credentials: false`, so the GitHub token is not left in `.git/config`.
- Removed `deploy-dev.yml`. It only ran on pushes to the stale `dev` branch
  (last run Aug 17, 2026), was the workflow the attacker injected into, and was
  the only workflow using `FIREBASE_TOKEN`. Staging now deploys through
  `deploy-staging-dev.yml` (Cloudflare Pages). `deploy-dev.sh` stays as a
  local maintainer script.

## Settings the owner must click (Settings of this repo)

### 1. Ruleset on `gh-pages`
Settings → Rules → Rulesets → New ruleset → New branch ruleset
(https://github.com/NEEDcreations/Bitcoin_Education_Archive/settings/rules/new?target=branch)
- Name: `protect-gh-pages`, Enforcement: **Active**
- Target branches: **Include default branch** (`gh-pages`)
- Bypass list: **Repository admin**, set to **"For pull requests only"**
  (lets you merge your own PRs, which GitHub won't let you approve, but never
  allows a direct push)
- Rules to turn on:
  - **Restrict deletions**
  - **Block force pushes**
  - **Require a pull request before merging**: required approvals 1,
    **Require review from Code Owners**, dismiss stale approvals on new commits,
    require conversation resolution
  - Optional: **Require signed commits** (if on, merge with "Squash and merge"
    so GitHub signs the result)
- Save.

### 2. Actions settings
Settings → Actions → General
(https://github.com/NEEDcreations/Bitcoin_Education_Archive/settings/actions)
- Fork pull request workflows from outside collaborators:
  **Require approval for all outside collaborators**
- Workflow permissions: **Read repository contents and packages permissions**
  (read-only default token), and **uncheck** "Allow GitHub Actions to create and
  approve pull requests"
- Optional: Actions permissions → "Allow NEEDcreations, and select non-NEEDcreations,
  actions" with "Require actions to be pinned to a full-length commit SHA"

### 3. Also review
- Collaborators (captainerr has write), deploy keys, webhooks, installed GitHub
  Apps: https://github.com/NEEDcreations/Bitcoin_Education_Archive/settings/access
- The other four repos (Frontier_Forge, node-run, QuantumAscent,
  zyn-magnesium-protocol) need the same ruleset and Actions settings.

## Same settings as API calls (owner token with Administration: write)
Not applied by this PR. For reference only.

```bash
REPO=NEEDcreations/Bitcoin_Education_Archive
# 1. Ruleset
gh api -X POST repos/$REPO/rulesets --input - <<'JSON'
{
  "name": "protect-gh-pages",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "require_code_owner_review": true,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
    } }
  ]
}
JSON
# optional: add { "type": "required_signatures" } to "rules"

# 2. Default workflow token read-only, Actions can't approve PRs
gh api -X PUT repos/$REPO/actions/permissions/workflow \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false

# 3. Require approval for all outside collaborators on fork PR runs
gh api -X PUT repos/$REPO/actions/permissions/fork-pr-contributor-approval \
  -f approval_policy=all_external_contributors
```

## Limits
A ruleset can't stop someone who holds the owner's own credential and uses the
admin bypass through a PR. The real fix for this incident is revoking the
stolen credential (see the incident steps sent privately to the owner).
