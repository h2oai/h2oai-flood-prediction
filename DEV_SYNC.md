---
noteId: "48dcd4809e8b11f0a6543d7c368dfc2a"
tags: []

---

# Development Sync Commands

This document contains commands for syncing code from private repository to public repository.

## Repository Setup

- **Private repo**: `h2oai/flood_prediction` (origin)
- **Public repo**: `h2oai/h2oai-flood-prediction-agent` (public)
- **Working branch**: `sp/nvidia-branch`
- **Public branch**: `public-main` → pushes to `main`

## ONE-TIME Setup for New Users

If you're a new user setting up the sync workflow for the first time:

```bash
# 1. Add public repo as a remote
git remote add public git@github.com:h2oai/h2oai-flood-prediction-agent.git

# 2. Fetch branches from public remote
git fetch public

# 3. Create local public-main branch tracking the public repo's main branch
git checkout -b public-main public/main

# 4. Switch back to working branch
git checkout sp/nvidia-branch
```

## Sync Workflow

### 1. Make changes in private repo
```bash
# Work on sp/nvidia-branch
git checkout sp/nvidia-branch

# Make your changes and commit
git add .
git commit -m "your commit message"
git push origin sp/nvidia-branch
```

### 2. Sync to public repo (builds new commit history)
```bash
# Switch to public-main branch
git checkout public-main

# Copy latest code from sp/nvidia-branch (overwrites current state)
git checkout sp/nvidia-branch -- .

# Stage all changes
git add .

# Commit with descriptive message (creates new commit in public repo)
git commit -m "Update: [describe changes]"

# Push to public repo main branch (normal push, builds history)
git push public public-main:main
```

## Quick Sync Script

You can create an alias for quick syncing:

```bash
# Add to your .gitconfig or .bash_profile
alias sync-public='git checkout public-main && git checkout sp/nvidia-branch -- . && git add . && git commit -m "Sync latest changes" && git push public public-main:main && git checkout sp/nvidia-branch'
```

Then just run:
```bash
sync-public
```

## Verify Remotes

```bash
git remote -v
# Should show:
# origin    git@github.com:h2oai/flood_prediction.git
# public    git@github.com:h2oai/h2oai-flood-prediction-agent.git
```

## Reverse Sync (Public → Private)

When managers push changes directly to public repo:

### Method 1: Cherry-pick (Recommended)
```bash
# 1. Check what commits managers added
git checkout public-main
git pull public main
git log --oneline -10  # See recent commits

# 2. Abort any ongoing merge if needed
git merge --abort  # Only if you have a merge in progress

# 3. Cherry-pick specific commits to your branch (in chronological order)
git checkout sp/nvidia-branch
git cherry-pick <oldest-commit-hash>
git cherry-pick <next-commit-hash>
git cherry-pick <newest-commit-hash>

# 4. Push to private repo
git push origin sp/nvidia-branch
```

### Method 2: Manual file copy
```bash
# 1. Pull public changes
git checkout public-main  
git pull public main

# 2. Manually copy changed files to your branch
git checkout sp/nvidia-branch
git checkout public-main -- path/to/changed/file.py
git add .
git commit -m "Apply manager changes from public repo"
git push origin sp/nvidia-branch
```

### If cherry-pick has conflicts:
```bash
# Resolve conflicts in files, then:
git add .
git cherry-pick --continue

# Or skip problematic commit:
git cherry-pick --skip
```

## Notes

- Public repo builds its own clean commit history (no old private commits)
- Each sync creates a new commit in the public repo
- Private repo commit history remains hidden
- Public repo grows with meaningful commit messages for each sync
- Always work on `sp/nvidia-branch` in private repo
- Use cherry-pick to bring manager changes from public to private repo