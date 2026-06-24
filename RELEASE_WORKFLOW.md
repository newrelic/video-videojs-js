# Release Workflow Documentation

## Overview

This project uses a two-stage automated release workflow that respects GitHub branch protection rules. The workflow automatically:

1. **Detects new releases** based on conventional commits
2. **Creates a release PR** with version bumps and changelog updates
3. **Runs compliance checks** (FOSSA, tests, etc.) on the PR
4. **Publishes to npm** after PR merge

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Developer: Push commits to master                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: Release Prepare (.github/workflows/release.yml)         │
├─────────────────────────────────────────────────────────────────┤
│ • Analyze commits with semantic-release                          │
│ • Detect version change needed                                   │
│ • Create release branch (chore/release-vX.Y.Z)                  │
│ • Update: package.json, package-lock.json, CHANGELOG.md         │
│ • Create PR with these changes                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ PR Checks (Automatic)                                            │
├─────────────────────────────────────────────────────────────────┤
│ ✓ FOSSA CLI Analysis                                             │
│ ✓ Other configured CI checks                                     │
│ ✓ Code review (if required)                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Merge to master                                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: Release Publish (.github/workflows/release-publish.yml)│
├─────────────────────────────────────────────────────────────────┤
│ • Detect new version (version ≠ latest tag)                     │
│ • Create git tag (vX.Y.Z)                                        │
│ • Trigger use-shared-publish.yml workflow:                       │
│   - Build package                                                │
│   - Publish to npm registry                                      │
│   - Upload dist to S3 (media-agents/browser/videojs)            │
│ • Create GitHub Release                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                    🎉 Release Complete
```

---

## Stage 1: Release Prepare

**Trigger**: Push to `master` branch (excluding commits with `[skip ci]`)

### Steps

#### 1. Checkout & Setup
- Checks out the latest `master` branch
- Fetches all git tags
- Configures git user as `github-actions[bot]`
- Sets up Node.js 24.x

#### 2. Install & Build
```bash
npm ci           # Install dependencies
npm run build    # Build the project
```

#### 3. Semantic Release Analysis
- Uses semantic-release to analyze conventional commits since last tag
- Determines next version based on:
  - `feat:` → Minor version bump
  - `fix:` → Patch version bump
  - `BREAKING CHANGE:` → Major version bump
  - Other types (chore, docs, etc.) → No release

#### 4. Version Detection
- Compares current `package.json` version with last git tag
- If versions match → No release needed, workflow ends
- If versions differ → Proceed to create PR

#### 5. Create Release Branch & PR
- Creates branch: `chore/release-vX.Y.Z`
- Runs semantic-release on the branch to update files:
  - `package.json` - version field
  - `package-lock.json` - lock version
  - `CHANGELOG.md` - new release notes
- Pushes branch to GitHub
- Creates a pull request with:
  - Title: `chore(release): vX.Y.Z`
  - Description explaining the changes
  - Linked to branch `chore/release-vX.Y.Z`

#### 6. Summary
Displays in GitHub Actions:
- Version number
- PR number and link
- Next steps (waiting for merge)

### Outputs
- `new-release-published`: `true` or `false`
- `new-release-version`: Version number (e.g., `4.2.1`)
- `pr-number`: GitHub PR number

---

## Stage 2: Release Publish

**Trigger**: Push to `master` branch (only when version in package.json differs from latest tag)

### Steps

#### 1. Check if New Release
- Gets current version from `package.json`
- Gets last release tag from git
- Compares versions
- If different → proceed with publishing
- If same → skip (no action needed)

#### 2. Checkout & Setup
- Checks out `master` branch
- Fetches all tags
- Configures git user
- Sets up Node.js

#### 3. Create Git Tag
- Creates annotated git tag: `vX.Y.Z`
- Pushes tag to GitHub
- Safety check: Won't re-create if tag already exists

#### 4. Trigger Shared Publish Workflow
- Dispatches the `use-shared-publish.yml` reusable workflow
- The shared workflow handles:
  - Building the project
  - Publishing to npm registry
  - Uploading dist file to S3 (`media-agents/browser/videojs`)
  - All credential management via shared secrets

Uses shared workflow from `newrelic/video-core-js` for centralized npm & S3 publishing.

#### 5. Create GitHub Release
- Creates GitHub Release from the git tag
- Auto-generates release notes from commits

#### 6. Monitor Shared Workflow
- `use-shared-publish.yml` runs in parallel after trigger
- Handles npm publish and S3 upload
- Check workflow logs if artifacts not published

#### 7. Summary
Displays in GitHub Actions:
- Version published
- Tag link
- npm package link
- S3 upload location
- Confirmation message

### Outputs
- Git tag created and pushed
- npm package published (via shared workflow)
- S3 artifact uploaded (via shared workflow)
- GitHub Release created

---

## Configuration Files

### `.releaserc.json`
Main semantic-release configuration:
- Analyzes commits using Angular preset
- Generates changelog with organized sections
- Updates version in `package.json` and `package-lock.json`
- Creates GitHub releases

### Workflow Files
- `.github/workflows/release.yml` - Stage 1: Prepare
- `.github/workflows/release-publish.yml` - Stage 2: Publish

---

## Conventional Commits

Version bumps are determined by commit message types:

```
feat(scope): Add new feature                    → Minor bump (4.2.0 → 4.3.0)
fix(scope): Fix a bug                           → Patch bump (4.2.0 → 4.2.1)
perf(scope): Performance improvement            → Patch bump (4.2.0 → 4.2.1)
revert(scope): Revert previous commit           → Patch bump (4.2.0 → 4.2.1)

docs: Update documentation                      → No release (4.2.0 stays)
chore: Dependency update                        → No release (4.2.0 stays)
test: Add tests                                 → No release (4.2.0 stays)
refactor: Code refactoring                      → No release (4.2.0 stays)

BREAKING CHANGE: ...                            → Major bump (4.2.0 → 5.0.0)
```

---

## How It Works: Step-by-Step Example

### Scenario: Fixing a bug and releasing

**1. Developer commits a fix:**
```bash
git commit -m "fix: resolve video loading issue"
git push origin feature/video-fix
```

**2. Developer creates PR and merges to master**

**3. Stage 1 Trigger (Release Prepare)**
- Workflow detects push to master
- Semantic-release analyzes commits
- Finds `fix:` commit → determines patch bump needed
- Current version: `4.2.0` → Next version: `4.2.1`
- Creates branch `chore/release-v4.2.1`
- Updates files:
  ```json
  // package.json
  {
    "version": "4.2.1"  // was 4.2.0
  }
  ```
- Creates `CHANGELOG.md` entry
- Creates PR: `chore(release): v4.2.1`
- FOSSA and other checks run on the PR

**4. PR Merge**
- Reviewer approves (or auto-merges if no approval required)
- Branch `chore/release-v4.2.1` merges to master
- Commit message includes `chore(release): v4.2.1`

**5. Stage 2 Trigger (Release Publish)**
- Workflow detects push to master after merge
- Checks version: `package.json` has `4.2.1`, latest tag is `v4.2.0`
- Versions differ → proceed with publishing
- Creates git tag: `v4.2.1`
- Triggers `use-shared-publish.yml` which:
  - Builds the distribution
  - Publishes to npm registry
  - Uploads dist file to S3 (`media-agents/browser/videojs/newrelic-video-videojs.min.js`)
- Creates GitHub Release with notes

**6. Result**
- npm: `@newrelic/video-videojs-js@4.2.1` published
- S3: Distribution file updated at `media-agents/browser/videojs`
- GitHub: Release `v4.2.1` created with changelog
- Repository: Tag `v4.2.1` points to the merge commit

---

## Branch Protection Rules

The workflow is designed to work with GitHub's branch protection rules:

```
master branch protection:
✓ Require pull request reviews before merging
✓ Require status checks to pass (FOSSA, tests, etc.)
✓ Require branches to be up to date before merging
✓ Require conversations to be resolved
✗ NO direct commits allowed
```

The old workflow tried to push directly to master → **Rejected by rules**

The new workflow:
1. Creates changes on a separate branch → ✓ Allowed
2. Creates PR for those changes → ✓ Follows rules
3. Runs all checks on PR → ✓ Respects branch protection
4. Merges via PR → ✓ Allowed
5. Publishes after merge → ✓ Operates on merged code

---

## Dry Run

Test the release process without publishing:

```bash
# Via GitHub UI:
# Actions → Release → Run workflow → Enable "dry-run"

# Via GitHub CLI:
gh workflow run release.yml -f dry-run=true -r master
```

Dry run output:
- Shows what version would be released
- Does NOT create PR or publish
- Safe for testing

---

## Manual Release (if needed)

### Force Release to Master

If you need to manually trigger a release:

```bash
# Push to master with version already bumped in package.json
git push origin master

# This triggers release-publish automatically
```

### Force Release with Workflow Dispatch

```bash
# Via GitHub CLI:
gh workflow run release-publish.yml -r master -f version=4.2.1

# Via GitHub Web UI:
# Actions → Release Publish → Run workflow → Enter version

# Note: This will create the tag and trigger use-shared-publish.yml
# which handles npm + S3 publishing
```

---

## Troubleshooting

### "No release published"
- Check commit messages since last tag
- Ensure commits use conventional format (feat:, fix:, etc.)
- Chore, docs, style, etc. won't trigger releases

### PR not created
- Check if another PR already exists for that version
- Verify branch `chore/release-vX.Y.Z` doesn't exist
- Check workflow logs for errors

### FOSSA check failed
- Address security issues flagged by FOSSA
- PR will remain open until issues resolved
- Publish won't trigger until PR merges

### Tag already exists
- Publish job detects existing tag and skips re-creation
- npm publish will fail if version already published
- Solution: Bump version and create new PR

### Shared workflow failed (npm or S3)
- Check `NPM_TOKEN` secret is configured
- Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets
- Verify npm registry access
- Verify S3 bucket permissions
- Check use-shared-publish workflow logs
- Ensure S3 path is correct: `media-agents/browser/videojs`

---

## Secrets Required

GitHub repository secrets needed:

| Secret | Purpose | Scope | Used By |
|--------|---------|-------|---------|
| `GITHUB_TOKEN` | Auto-included by GitHub Actions | Read/write on repository | Both stages |
| `NPM_TOKEN` | Publish packages to npm registry | npm account with publish permissions | use-shared-publish.yml |
| `AWS_ACCESS_KEY_ID` | AWS authentication for S3 upload | S3 bucket write access | use-shared-publish.yml |
| `AWS_SECRET_ACCESS_KEY` | AWS secret for S3 upload | S3 bucket write access | use-shared-publish.yml |

---

## Environment Variables

Node.js version: **24.x** (configured in workflows)

---

## Files Modified During Release

During the release PR creation, these files are updated:

1. **package.json**
   - `version` field updated to new version

2. **package-lock.json**
   - Auto-updated by npm to match new version

3. **CHANGELOG.md**
   - New section added with release notes
   - Organized by commit type (Features, Bug Fixes, etc.)
   - Contains commit links to GitHub

Example CHANGELOG entry:
```markdown
## [4.2.1](https://github.com/newrelic/video-videojs-js/compare/v4.2.0...v4.2.1) (2024-06-24)

### Bug Fixes

* resolve video loading issue ([abc1234](https://github.com/newrelic/video-videojs-js/commit/abc1234))
```

---

## Changelog Format

The CHANGELOG follows the [Keep a Changelog](https://keepachangelog.com/) format with Angular commit categories:

```markdown
## [X.Y.Z](link) (YYYY-MM-DD)

### Features
- New features go here

### Bug Fixes
- Bug fixes go here

### Performance Improvements
- Performance improvements here

### Code Refactoring
- Refactoring notes (hidden by default)

### Reverts
- Reverted changes

### Chores
- Chore updates (hidden by default)

### Tests
- Test additions (hidden by default)

### Build System
- Build changes (hidden by default)

### Continuous Integration
- CI changes (hidden by default)
```

---

## Notifications

### GitHub Actions UI
- Each workflow displays summaries in the Actions tab
- Release Prepare: Shows PR number and link
- Release Publish: Shows version, tag, and npm link

### GitHub Notifications
- PR created for release → Notifications sent
- PR merged → Merge notification
- Release created → Release notification (optional)

### npm Registry
- Published package visible immediately at npm.org
- New version appears in package history

---

## Version History

### Before (Old Workflow - Broken)
```
Push to master → semantic-release tries git push → 
Rejected by branch protection → Failed ❌
```

### After (New Workflow - Working)
```
Push to master → Create PR with version bump → 
FOSSA checks pass → Merge PR → 
Auto-publish → Success ✅
```

---

## Best Practices

1. **Keep commits clean**
   - Use conventional commit format
   - One feature/fix per commit when possible
   - Write clear commit messages

2. **Don't bump version manually**
   - semantic-release determines version automatically
   - Manual edits can cause conflicts

3. **Review release PRs**
   - Check changelog accuracy
   - Verify version number is correct
   - Ensure no unwanted changes snuck in

4. **Monitor FOSSA results**
   - Address security issues before merge
   - Keep dependencies up to date
   - Review new dependencies

5. **Keep tags synchronized**
   - Don't create tags manually
   - Let the workflow manage versioning
   - Ensures consistency with npm registry

---

## FAQ

**Q: How often should I release?**
A: Release whenever you have features, fixes, or important changes. Could be weekly, monthly, or per feature.

**Q: Can I skip a release?**
A: If no commits warrant a release (only chores/docs), no PR is created. The workflow just stops.

**Q: Can I revert a release?**
A: Yes, but it's complex:
- Delete the tag: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
- Unpublish from npm: `npm unpublish @newrelic/video-videojs-js@X.Y.Z`
- Prefer: Create a new patch release with a revert commit

**Q: How do I test the workflow?**
A: Use dry-run mode (see above), or create a test branch and manually trigger workflows.

**Q: What if the release PR is rejected?**
A: Fix the issues flagged by checks, push new commits to the release branch, and the PR updates automatically.

**Q: Can multiple releases happen at once?**
A: No. Each release creates its own branch/PR. Workflow prevents conflicts.

**Q: How long does a release take?**
A: Stage 1 (prepare): ~2-3 minutes. Stage 2 (publish): ~1-2 minutes after merge.

---

## Related Documentation

- [semantic-release docs](https://semantic-release.gitbook.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [npm publish](https://docs.npmjs.com/cli/v8/commands/npm-publish)

---

**Last Updated**: 2024-06-24  
**Workflow Version**: 2.0 (Two-stage workflow respecting branch protection)
