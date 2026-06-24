# Release Workflow Documentation

## Overview

This document explains the **sprint-based release workflow** for this repository, from feature development through deployment to NPM and AWS S3.

### Workflow Strategy: Sprint-Based Release Branching

Unlike a direct-to-master workflow, your process uses **release branches per sprint**:

| Aspect | Your Approach |
|--------|---|
| **Branch Structure** | Feature branches merge to `release/sprint-XX`, then to `master` |
| **PR Targets** | All feature PRs target the release branch, NOT master |
| **Release Trigger** | When release branch is merged to master (not individual features) |
| **Version Bump** | Based on ALL sprint commits accumulated in release branch |
| **Git History** | Cleaner - each master commit represents one complete sprint |
| **Automation** | Triggered only once per sprint when release branch merges to master |

**Benefits:**
- ✅ All sprint features tested together before release
- ✅ Cleaner git history (sprint as atomic unit)
- ✅ Single version bump per sprint (not per feature)
- ✅ Easy to rollback entire sprint if needed

---

## Development & Release Workflow Process (Sprint-Based)

### Overview
Your workflow uses a **sprint-based release branch** strategy:
- One release branch per sprint
- All features for sprint merged to release branch
- Release branch then merged to master (triggers automation)
- Cleaner history with grouped sprint changes

### Phase 1: Sprint Planning & Release Branch Creation

```
┌─────────────────────────────────────────────────────────────┐
│ Sprint Starts                                                │
│ Create ONE release branch for the entire sprint             │
│ git checkout -b release/sprint-XX master                    │
│ Example: release/sprint-45, release/Q2-2026                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Release branch is pushed to GitHub                          │
│ This becomes the integration branch for the sprint          │
│ All feature PRs will target this branch                     │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Sprint Development (Multiple Feature Branches)

```
┌─────────────────────────────────────────────────────────────┐
│ Each developer creates feature branch from master           │
│ git checkout -b feat/my-feature master                     │
│ Examples:                                                   │
│ - feat/video-quality-selector                              │
│ - feat/subtitle-support                                    │
│ - fix/playback-bug                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Developer makes commits with conventional commit messages    │
│ - feat: add new feature                                     │
│ - fix: resolve bug                                          │
│ - docs: update documentation                                │
│ - chore: maintenance tasks                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Developer pushes feature branch and creates Pull Request     │
│ 🔑 IMPORTANT: PR TARGET = release/sprint-XX                 │
│    (NOT master branch)                                      │
│ PR includes detailed description and testing notes          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Code Review & Testing                                        │
│ - Reviewer examines changes                                 │
│ - CI/CD pipeline runs tests                                 │
│ - Integration testing against other sprint features         │
│ - Reviewer approves PR                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Merge PR to Release Branch                                  │
│ Target: release/sprint-XX                                  │
│ git merge feature-branch                                    │
│ PR is closed and merged                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ REPEAT: Multiple PRs merged to release branch              │
│ Throughout sprint, many features accumulated in:            │
│ release/sprint-XX                                           │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Sprint Release (Release Branch → Master)

```
┌─────────────────────────────────────────────────────────────┐
│ Sprint Complete                                              │
│ All features integrated into release/sprint-XX              │
│ QA testing and final approval done                          │
│ Ready to release                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Create Final Pull Request                                    │
│ Source: release/sprint-XX                                  │
│ Target: master                                              │
│ Title: "chore(release): merge sprint-XX"                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Final Review & Approval                                      │
│ Lead/PM reviews all sprint changes                          │
│ Approves merge to master                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Merge Release Branch to Master                              │
│ git merge release/sprint-XX                                │
│ This single commit contains all sprint features             │
│ Pushed to master branch                                     │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Automated Release Workflow (Triggered on Master Merge)

When a PR is merged to the `master` branch, the **Release Workflow** (`.github/workflows/release.yml`) is automatically triggered:

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub detects push to master branch                        │
│ Trigger: release.yml workflow                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Code Checkout                                       │
│ - Checkout master branch                                   │
│ - Fetch all commit history (fetch-depth: 0)               │
│ - Used for conventional commit analysis                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Git Configuration                                   │
│ - Configure bot identity (github-actions[bot])             │
│ - Used to commit version updates                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Environment Setup                                   │
│ - Install Node.js 24.x                                     │
│ - Setup npm cache for faster installs                      │
│ - Run: npm ci (clean install)                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Build Project                                       │
│ - Run: npm run build                                        │
│ - Compile/bundle the project                               │
│ - Ensure no build errors                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Verify Configuration                                │
│ - Check .releaserc.json exists                             │
│ - Contains semantic-release configuration                  │
│ - Defines version bumping rules                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Semantic Release Analysis                           │
│ semantic-release analyzes commits since last release:       │
│                                                             │
│ Commit Types → Version Bump:                               │
│ • feat: X.Y.Z → X.(Y+1).0    (Minor version bump)         │
│ • fix/perf: X.Y.Z → X.Y.(Z+1) (Patch version bump)        │
│ • BREAKING CHANGE: X.Y.Z → (X+1).0.0 (Major bump)         │
│ • chore/docs/test: No release (no version bump)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Automatic Updates (if release triggered)            │
│ semantic-release automatically:                            │
│ • Updates package.json (version field)                     │
│ • Updates package-lock.json                                │
│ • Updates CHANGELOG.md with release notes                  │
│ • Creates git commit: "chore(release): v1.2.3"            │
│ • Tags commit: v1.2.3                                      │
│ • Pushes commit and tag to master                          │
│ • Creates GitHub Release with notes                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: Release Detection                                   │
│ - Check if new git tag was created                         │
│ - Extract version from package.json                        │
│ - Set workflow outputs:                                    │
│   • new-release-published: true/false                      │
│   • new-release-version: 1.2.3                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 9: Workflow Summary                                    │
│ Generate GitHub Actions summary showing:                   │
│ • Released version number                                  │
│ • Git tag created                                          │
│ • Link to GitHub Release page                              │
│ • What changes were made                                   │
│ • Next steps (NPM publish)                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 10: Trigger NPM Publish Workflow                       │
│ - Only if new release was published                        │
│ - Triggers: use-shared-publish.yml workflow                │
│ - Workflow publishes package to NPM registry               │
│ - Version becomes available for: npm install               │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Workflow Breakdown

### Trigger Conditions

The release workflow is triggered in two scenarios:

1. **Automatic**: When code is pushed to `master` branch
   - Skips if commit message contains `[skip ci]` (prevents recursion)
   - This is used by the release bot's own commits

2. **Manual**: Using GitHub UI workflow dispatch
   - Can perform dry-run (test without actual release)
   - Useful for testing release configuration

### Semantic Versioning & Conventional Commits

The workflow uses **Semantic Release** which analyzes commit messages accumulated in the release branch:

**Commit Message Format:**
```
type(scope): subject

body

footer
```

**Examples (Per Sprint):**
```
SPRINT 45 COMMITS:
  feat: add video quality selector          ← +1 MINOR
  feat: add subtitle support                ← +1 MINOR  
  fix: correct playback bug                 ← (counted as minor since feat exists)
  docs: update README                       ← (ignored)
  
RESULT: v1.0.0 → v1.2.0 (2 features = +0.2.0)

SPRINT 46 COMMITS:
  fix: correct edge case
  fix: resolve race condition
  
RESULT: v1.2.0 → v1.2.2 (2 fixes = +0.0.2)

SPRINT 47 COMMITS:
  feat!: redesign player API                ← BREAKING CHANGE
  feat: new theme system
  
RESULT: v1.2.2 → v2.0.0 (breaking change = +1.0.0)
```

**Version Bump Rules:**
- `feat:` commits → **Minor version** (X.Y.0 → X.(Y+1).0)
- `fix:` or `perf:` commits → **Patch version** (X.Y.Z → X.Y.(Z+1))
- `feat!:` or `BREAKING CHANGE:` → **Major version** (X.Y.Z → (X+1).0.0)
- `docs:`, `chore:`, `test:` → **No release** (version stays same)

---

## Current Workflow Capabilities

### ✅ What Works Now

1. **Automatic Version Bumping**
   - Analyzes commit history
   - Determines next version (major.minor.patch)
   - Updates package.json

2. **Changelog Generation**
   - Generates CHANGELOG.md
   - Documents all changes in release
   - Categorizes commits by type

3. **Git Management**
   - Creates git tags (v1.2.3)
   - Creates GitHub Release page
   - Pushes commits and tags to master

4. **NPM Publishing**
   - Triggers secondary workflow (`use-shared-publish.yml`)
   - Publishes to NPM registry
   - Makes package available for installation

5. **AWS S3 Hosting**
   - Builds distribution file (`dist/umd/newrelic-video-videojs.min.js`)
   - Uploads to AWS S3: `s3://bucket/media-agents/browser/videojs/`
   - Uses shared workflow from `newrelic/video-core-js`
   - Includes CloudFront invalidation (if configured)

6. **Dry-Run Capability**
   - Test release without publishing
   - Validate configuration
   - Preview version bump

---

## AWS S3 Hosting Implementation

### ✅ Currently Implemented via Shared Workflow

AWS S3 hosting **IS already implemented**! It uses a shared reusable workflow from `newrelic/video-core-js`.

#### How It Works:

**File**: `.github/workflows/use-shared-publish.yml`

```yaml
name: Build and Publish

on:
  workflow_dispatch:    # Triggered by release.yml

jobs:
  build-and-publish:
    uses: newrelic/video-core-js/.github/workflows/npm-publish.yml@stable
    with:
      s3-path: 'media-agents/browser/videojs'
      file-to-upload: 'dist/umd/newrelic-video-videojs.min.js'
    secrets:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

#### What This Does:

1. **Uses Shared Workflow**: Leverages `npm-publish.yml` from `newrelic/video-core-js@stable`
2. **Builds Distribution**: Generates `dist/umd/newrelic-video-videojs.min.js`
3. **Publishes to NPM**: Registers new version with NPM registry
4. **Uploads to AWS S3**: 
   - **Path**: `s3://[bucket]/media-agents/browser/videojs/`
   - **File**: `newrelic-video-videojs.min.js`
   - **Pattern**: Version-specific files are stored and accessible

#### Configuration:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `s3-path` | `media-agents/browser/videojs` | S3 bucket path for uploads |
| `file-to-upload` | `dist/umd/newrelic-video-videojs.min.js` | Minified UMD build |
| `AWS_ACCESS_KEY_ID` | Secret | AWS authentication |
| `AWS_SECRET_ACCESS_KEY` | Secret | AWS authentication |

#### Flow Diagram:

```
release.yml creates tag & publishes
           ↓
Triggers use-shared-publish.yml
           ↓
Calls shared workflow: npm-publish.yml@stable
           ↓
┌─────────────────────────────────────────┐
│ Shared Workflow (from video-core-js)    │
├─────────────────────────────────────────┤
│ • npm ci                                │
│ • npm run build                         │
│ • npm publish (to NPM registry)         │
│ • aws s3 cp dist/umd/...               │
│   → s3://bucket/media-agents/...       │
│ • CloudFront invalidation (if config)   │
└─────────────────────────────────────────┘
           ↓
✅ Package available on NPM
✅ Files available on AWS S3
```

---

## Complete Release Flow Summary (Sprint-Based)

```
SPRINT START
      ↓
Create Release Branch from master
  git checkout -b release/sprint-XX master
      ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPRINT DEVELOPMENT (Multiple concurrent features)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ↓
Developer 1: Create feat/feature-name-1 branch
  └─ Commit: feat: add feature 1
  └─ PR → release/sprint-XX (IMPORTANT!)
  └─ Review & Merge
      ↓
Developer 2: Create feat/feature-name-2 branch
  └─ Commit: fix: resolve bug
  └─ PR → release/sprint-XX (IMPORTANT!)
  └─ Review & Merge
      ↓
Developer 3: Create feat/feature-name-3 branch
  └─ Commit: feat: add feature 3
  └─ PR → release/sprint-XX (IMPORTANT!)
  └─ Review & Merge
      ↓
... More PRs merged to release/sprint-XX ...
      ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPRINT END - READY TO RELEASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      ↓
Create Final PR: release/sprint-XX → master
  └─ Code review of all sprint changes
  └─ Final approval from lead/PM
      ↓
Merge Release Branch to Master
  git merge release/sprint-XX → master
  └─ Single merge commit with all sprint changes
      ↓
🚀 AUTOMATIC: release.yml workflow TRIGGERED
      ├─ Checkout master branch
      ├─ Setup Node.js environment
      ├─ Install dependencies (npm ci)
      ├─ Build project (npm run build)
      ├─ Verify .releaserc.json exists
      ├─ Analyze commits since last release
      │  └─ Sees all sprint commits:
      │     • feat: add feature 1
      │     • fix: resolve bug
      │     • feat: add feature 3
      │
      ├─ Calculate version bump
      │  └─ 2 feat commits = MINOR version bump
      │     v1.2.0 → v1.3.0
      │
      ├─ ✏️ Update package.json → v1.3.0
      ├─ ✏️ Update CHANGELOG.md with all sprint changes
      ├─ ✏️ Create git tag: v1.3.0
      ├─ ✏️ Create GitHub Release page
      └─ Generate Workflow Summary
      ↓
📦 AUTOMATIC: use-shared-publish.yml TRIGGERED
      ├─ Build distribution (npm run build)
      ├─ 📤 Publish to NPM Registry (v1.3.0)
      │  └─ npm install @newrelic/video-videojs@1.3.0 ✅
      └─ 📤 Upload to AWS S3
         ├─ Path: s3://bucket/media-agents/browser/videojs/
         ├─ File: newrelic-video-videojs.min.js (v1.3.0)
         └─ CloudFront invalidation ✅
      ↓
✅ SPRINT RELEASED!
   • v1.3.0 tagged in git
   • Available on NPM
   • Hosted on AWS S3
   • GitHub Release notes created
      ↓
Next Sprint Begins
  git checkout -b release/sprint-(XX+1) master
  ... repeat process ...
```

---

## Configuration Files

### `.releaserc.json`
- Configures semantic-release behavior
- Defines commit analyzer rules
- Specifies changelog generator
- Controls publishing plugins

### `.github/workflows/release.yml`
- **Primary orchestration file**
- Triggered: On push to master (auto) or workflow dispatch (manual)
- Steps:
  1. Checkout master branch
  2. Configure git identity
  3. Setup Node.js environment
  4. Install & build project
  5. Run semantic-release
  6. Trigger use-shared-publish workflow
- Outputs: `new-release-published`, `new-release-version`

### `.github/workflows/use-shared-publish.yml`
- **Triggered by**: release.yml (only if release published)
- **Type**: Reusable workflow dispatch
- **Calls**: `newrelic/video-core-js/.github/workflows/npm-publish.yml@stable`
- **What it does**:
  - Publishes package to NPM registry
  - Uploads minified build to AWS S3
  - Invalidates CloudFront cache (if configured)
- **Credentials Required**:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
- **Configuration**:
  - S3 path: `media-agents/browser/videojs`
  - File: `dist/umd/newrelic-video-videojs.min.js`

---

## Key Permissions Required

```yaml
permissions:
  contents: write          # Allows creating commits, tags, releases
  issues: write            # For linking PRs to issues
  pull-requests: write     # For commenting on PRs
  id-token: write          # For OIDC authentication (if used)
  actions: write           # For triggering other workflows
```

---

## Environment Variables & Secrets

| Variable | Purpose | Required |
|----------|---------|----------|
| `GITHUB_TOKEN` | Authenticate with GitHub API | ✅ Yes |
| `NPM_TOKEN` | Authenticate with NPM registry | ✅ Yes (for publishing) |
| `AWS_ACCESS_KEY_ID` | AWS authentication | ❌ Not yet |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication | ❌ Not yet |

---

## Common Issues & Solutions

### Issue 1: Release Not Publishing
**Cause**: No conventional commits since last release
**Solution**: Ensure commit messages follow format (feat:, fix:, etc)

### Issue 2: Recursive Releases
**Cause**: Release bot's commit triggers another release
**Solution**: `[skip ci]` in commit message prevents this

### Issue 3: Version Not Updating
**Cause**: .releaserc.json configuration error
**Solution**: Validate configuration file syntax

### Issue 4: Permission Denied on Push
**Cause**: GITHUB_TOKEN insufficient permissions
**Solution**: Ensure `contents: write` permission is set

---

## Your Complete Workflow Summary

### Key Points for Sprint-Based Releases

1. **Create ONE Release Branch per Sprint**
   ```
   git checkout -b release/sprint-45 master
   ```

2. **All Feature PRs Target the Release Branch**
   ```
   Feature Branch → PR to release/sprint-45 (NOT master)
   ```

3. **Merge Release Branch to Master When Sprint Complete**
   ```
   git checkout master
   git merge release/sprint-45
   git push origin master
   ```

4. **Automatic Release Workflow Triggers**
   - Analyzes ALL sprint commits (feat:, fix:, etc.)
   - Calculates version bump
   - Updates package.json, CHANGELOG.md
   - Creates git tag & GitHub Release

5. **Automatic Publishing Workflow Triggers**
   - Publishes to NPM
   - Uploads to AWS S3
   - Invalidates CDN cache

### What Happens When Release Branch Merges to Master

```
1. Developer merges release/sprint-XX → master
   ↓
2. GitHub triggers release.yml
   ↓
3. Semantic-release analyzes ALL sprint commits:
   - feat: add feature 1        ← MINOR bump
   - fix: resolve bug           ← patch increment
   - feat: add feature 3        ← MINOR bump
   - Determines version bump: v1.2.0 → v1.3.0
   ↓
4. Automatic Updates:
   ✏️ package.json:     "version": "1.3.0"
   ✏️ CHANGELOG.md:     "## [1.3.0] - 2026-06-23"
   ✏️ Git tag:          v1.3.0
   ✏️ Git commit:       chore(release): 1.3.0
   ✏️ GitHub Release:   https://github.com/.../releases/tag/v1.3.0
   ↓
5. release.yml detects new tag
   ↓
6. release.yml triggers use-shared-publish.yml
   ↓
7. use-shared-publish.yml:
   📦 npm publish → v1.3.0 available
   📤 aws s3 cp dist/umd/... → s3://bucket/media-agents/browser/videojs/
   🔄 cloudfront invalidation
   ↓
8. Sprint Released! ✅
   ✅ npm install @newrelic/video-videojs@1.3.0 works
   ✅ Files accessible on AWS S3 CDN (v1.3.0)
```

### Files Involved in Release

| File | Purpose |
|------|---------|
| `package.json` | Updated with new version |
| `package-lock.json` | Updated lock file |
| `CHANGELOG.md` | Release notes appended |
| `.releaserc.json` | Release configuration |
| `.github/workflows/release.yml` | Main release workflow |
| `.github/workflows/use-shared-publish.yml` | Publish & S3 upload workflow |
| `dist/umd/newrelic-video-videojs.min.js` | Built artifact uploaded to S3 |

---

## Recommended Next Steps

1. ✅ **Test the workflow** - Trigger manual dry-run from GitHub UI
2. ✅ **Verify AWS credentials** - Ensure secrets are configured
3. ✅ **Validate S3 uploads** - Check S3 bucket after release
4. 📊 **Monitor releases** - Set up alerts for failed workflows
5. 🔐 **Secure secrets** - Rotate AWS credentials periodically
6. 📝 **Document commit conventions** - Create CONTRIBUTING.md for team
7. 🔄 **Test full workflow** - Create feature branch → PR → Merge → Watch release

---

## Useful Commands

```bash
# Test dry-run manually
npm run semantic-release -- --dry-run

# View commit history
git log --oneline

# Check current version
jq '.version' package.json

# View release configuration
cat .releaserc.json
```

---

## References

- [Semantic Release Documentation](https://semantic-release.gitbook.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS S3 CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/s3/)
