# Workflow Testing Guide

## Overview

This guide helps you test the complete release workflow in a forked repository without affecting the main repository.

---

## Step 1: Fork the Repository

### On GitHub:
1. Go to: https://github.com/newrelic/video-videojs-js
2. Click **Fork** button (top right)
3. Choose your account as destination
4. Click **Create fork**

### Result:
```
Your GitHub: username/video-videojs-js (forked)
↑
Original: newrelic/video-videojs-js (upstream)
```

### Clone Your Fork Locally:
```bash
git clone https://github.com/YOUR-USERNAME/video-videojs-js.git
cd video-videojs-js
git remote add upstream https://github.com/newrelic/video-videojs-js.git
```

### Fetch Tags from Upstream (Important!)

Forks don't automatically include tags from the original repository. Fetch them:

```bash
# Fetch all tags from upstream
git fetch upstream --tags

# Verify tags are now available
git tag -l
```

**Expected Output:**
```
v1.0.0
v1.1.0
v1.2.0
v2.0.0
... (all tags from original repo)
```

This is important because:
- ✅ Semantic-release needs previous tags to calculate version bumps
- ✅ Git history includes all releases
- ✅ Workflow can detect if a new release was published

---

## Step 2: Configure GitHub Secrets for Workflow

### What Secrets You Need:

| Secret | Purpose | Where to Get |
|--------|---------|--------------|
| `GITHUB_TOKEN` | Auto-generated (default) | Built-in |
| `AWS_ACCESS_KEY_ID` | AWS S3 uploads | AWS Console or use dummy for testing |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 uploads | AWS Console or use dummy for testing |

### Add Secrets to Your Fork:

1. Go to: `https://github.com/YOUR-USERNAME/video-videojs-js/settings/secrets/actions`
2. Click **New repository secret**
3. Add the following:

**Option A: Real AWS Credentials (Recommended for Full Testing)**
```
Name: AWS_ACCESS_KEY_ID
Value: [Your AWS Access Key]

Name: AWS_SECRET_ACCESS_KEY
Value: [Your AWS Secret Key]
```

**Option B: Dummy Credentials (For Workflow Logic Testing)**
```
Name: AWS_ACCESS_KEY_ID
Value: DUMMY_KEY_FOR_TESTING

Name: AWS_SECRET_ACCESS_KEY
Value: DUMMY_SECRET_FOR_TESTING
```

> Note: GITHUB_TOKEN is provided automatically by GitHub Actions

---

## Step 3: Test Release Workflow (Dry Run)

### Method 1: Manual Workflow Dispatch (Recommended First Test)

1. Go to: `https://github.com/YOUR-USERNAME/video-videojs-js/actions`
2. Click **Release** workflow on the left
3. Click **Run workflow** button
4. Toggle **Perform a dry run** to `true`
5. Click **Run workflow** (green button)

### What Happens:
- ✅ Workflow runs without publishing
- ✅ Shows what VERSION would be bumped
- ✅ Shows what CHANGELOG would be updated
- ✅ No actual release created
- ✅ No NPM publish
- ✅ No S3 upload

### Expected Output:
```
✅ Steps run successfully
✅ Summary shows: "Would release v1.X.X"
✅ No git tags created
```

---

## Step 4: Test Sprint-Based Release Workflow (Full Flow)

### Step 4A: Create Release Branch

```bash
git checkout master
git pull origin master
git checkout -b release/test-sprint-01
git push origin release/test-sprint-01
```

### Step 4B: Create Feature Branches & Commit

Create multiple features merged to the release branch:

**Feature 1:**
```bash
git checkout -b feat/test-feature-1 release/test-sprint-01
echo "// Feature 1" >> src/index.js
git add src/index.js
git commit -m "feat: add test feature 1"
git push origin feat/test-feature-1
```

**Feature 2:**
```bash
git checkout -b feat/test-feature-2 release/test-sprint-01
echo "// Feature 2" >> src/index.js
git add src/index.js
git commit -m "fix: fix test issue"
git push origin feat/test-feature-2
```

### Step 4C: Create PRs to Release Branch

1. Go to your fork on GitHub
2. Create PR: `feat/test-feature-1` → `release/test-sprint-01`
3. Merge the PR (self-approve in your fork)
4. Create PR: `feat/test-feature-2` → `release/test-sprint-01`
5. Merge the PR

### Step 4D: Merge Release Branch to Master

```bash
git checkout master
git pull origin master
git merge release/test-sprint-01
git push origin master
```

### What Happens Automatically:

1. ✅ GitHub detects push to `master`
2. ✅ `release.yml` workflow triggers
3. ✅ Analyzes commits: `feat:` and `fix:` detected
4. ✅ Calculates version bump (e.g., v1.0.0 → v1.1.0)
5. ✅ Updates `package.json`
6. ✅ Updates `CHANGELOG.md`
7. ✅ Creates git tag (v1.1.0)
8. ✅ Creates GitHub Release
9. ✅ Triggers `use-shared-publish.yml` workflow
10. ✅ Attempts to publish to NPM (may fail if not configured)
11. ✅ Attempts to upload to AWS S3 (may fail if not configured)

---

## Step 5: Monitor Workflow Execution

### View Live Workflow Run:

1. Go to: `https://github.com/YOUR-USERNAME/video-videojs-js/actions`
2. Click the workflow run
3. Watch steps execute in real-time
4. Click individual steps to see logs

### Expected Workflow Steps:

```
release.yml:
  ✅ Checkout code
  ✅ Setup git
  ✅ Set up Node.js
  ✅ Install dependencies
  ✅ Run build
  ✅ Verify .releaserc.json
  ✅ Run semantic-release
  ✅ Get released version
  ✅ Summary - Release Created
  ✅ Trigger use-shared-publish workflow

use-shared-publish.yml:
  ✅ Build and Publish (calls shared workflow)
  ✅ May show warnings if AWS creds are dummy
```

---

## Step 6: Verify Results

### Check Git Changes:

```bash
# Verify version was updated
cat package.json | grep version

# Verify tag was created
git tag -l | grep v1.

# Verify commits on master
git log --oneline master -5
```

### Expected Git Output:
```
chore(release): 1.1.0                    ← Release bot commit
feat: add test feature 1                 ← Your sprint feature
fix: fix test issue                      ← Your sprint fix
Merge pull request #X from release/...  ← Release branch merge
... previous commits ...
```

### Check CHANGELOG:

```bash
# View updated changelog
head -20 CHANGELOG.md
```

### Expected CHANGELOG Output:
```markdown
## [1.1.0] - 2026-06-23

### Features
- add test feature 1

### Bug Fixes
- fix test issue

## [1.0.0] - 2026-06-20
...
```

### Check GitHub Release Page:

1. Go to: `https://github.com/YOUR-USERNAME/video-videojs-js/releases`
2. See new release: `v1.1.0` created automatically
3. Release notes auto-generated from commits

---

## Step 7: Test Consecutive Sprints

### Repeat for Next Sprint:

```bash
# Create new release branch
git checkout -b release/test-sprint-02 master

# Create feature
git checkout -b feat/test-feature-3 release/test-sprint-02
echo "// Feature 3" >> src/index.js
git commit -m "feat: add test feature 3"
git push origin feat/test-feature-3

# PR and merge to release branch, then to master
# ... (follow steps 4C-4D above) ...

# This time version should bump:
# v1.1.0 → v1.2.0 (another feature)
```

---

## Expected Test Results

### Successful Workflow:
```
SPRINT 1:
  ✅ feat: add test feature 1
  ✅ fix: fix test issue
  → Version: v1.0.0 → v1.1.0
  → Git tag: v1.1.0 created
  → CHANGELOG.md updated
  → GitHub Release page created
  → NPM publish attempted
  → AWS S3 upload attempted

SPRINT 2:
  ✅ feat: add test feature 3
  → Version: v1.1.0 → v1.2.0
  → Git tag: v1.2.0 created
  → CHANGELOG.md updated
  → GitHub Release page created
```

---

## Common Testing Scenarios

### Scenario 1: Only Docs/Chores (No Release)

```bash
echo "// Documentation" >> README.md
git commit -m "docs: update readme"
git push origin master
```

**Expected**: No version bump, no release

### Scenario 2: Breaking Change (Major Bump)

```bash
git commit -m "feat!: redesign API"
git push origin master
```

**Expected**: v1.2.0 → v2.0.0 (major version bump)

### Scenario 3: Fix-Only Release (Patch Bump)

```bash
git commit -m "fix: resolve issue"
git push origin master
```

**Expected**: v2.0.0 → v2.0.1 (patch version bump)

---

## Troubleshooting

### Issue 0: Missing Tags in Fork (IMPORTANT!)
**Problem**: Running `git tag -l` shows no tags or incomplete tags

**Solution**: Fetch tags from upstream
```bash
# Add upstream if not already added
git remote add upstream https://github.com/newrelic/video-videojs-js.git

# Fetch all tags
git fetch upstream --tags

# Verify
git tag -l
```

**Why This Matters**:
- Semantic-release calculates version bumps based on the last tag
- Without previous tags, workflow might calculate wrong version numbers
- Always fetch tags before running the workflow

---

### Issue 1: Workflow Not Triggering
- ✅ Ensure you pushed to `master` branch
- ✅ Check workflow is not skipped: no `[skip ci]` in commit message
- ✅ Go to Actions tab to see if workflow runs

### Issue 2: Semantic Release Not Finding Commits
- ✅ Ensure commits follow conventional format: `feat:`, `fix:`, etc.
- ✅ Check `.releaserc.json` exists and is valid
- ✅ Run locally: `npm run semantic-release -- --dry-run`

### Issue 3: AWS Upload Failed
- ✅ If using dummy credentials: This is expected (won't actually upload)
- ✅ Check AWS credentials are correct in secrets
- ✅ Check S3 bucket exists and is accessible

### Issue 4: NPM Publish Failed
- ✅ If not configured: This is expected
- ✅ Check `.npmrc` configuration
- ✅ Verify NPM_TOKEN secret is set (if required)

---

## After Testing: Merge Fork Changes to Main

Once you've validated everything works:

```bash
# Push your test to fork
git push origin test-branch

# Create PR from fork to upstream
# On GitHub: Your-Fork → upstream/master

# After approval, changes go back to main repo
```

---

## Quick Reference: Complete Test Workflow

```bash
# 1. Fork and clone
git clone https://github.com/YOUR-USERNAME/video-videojs-js.git
cd video-videojs-js

# 2. Create release branch
git checkout -b release/test-sprint-01

# 3. Create and merge features
git checkout -b feat/test1 release/test-sprint-01
git commit -m "feat: test feature"
git push origin feat/test1
# Create PR, merge to release/test-sprint-01

# 4. Merge release to master (TRIGGERS WORKFLOW)
git checkout master
git merge release/test-sprint-01
git push origin master

# 5. Watch workflow
# Go to: https://github.com/YOUR-USERNAME/video-videojs-js/actions

# 6. Verify results
git tag -l
cat package.json | grep version
cat CHANGELOG.md | head -20
```

---

## Next Steps

1. ✅ Fork the repository
2. ✅ Configure secrets (AWS, if available)
3. ✅ Run dry-run workflow first
4. ✅ Create test sprint with features
5. ✅ Merge to master and watch automation
6. ✅ Verify version bump, tags, CHANGELOG
7. ✅ Test multiple sprints
8. ✅ Validate S3 uploads (if credentials configured)
9. ✅ Report findings
10. ✅ Create PR back to main repo with any fixes
