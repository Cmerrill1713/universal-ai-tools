# GitHub SSH Key Setup Instructions

## Your New SSH Key

**Public Key to Add to GitHub:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICNtnlrcIUbAa1b87pIh0o/sk/Dr0mKICeKMHMGyZNzg cmerrill1713@gmail.com
```

## Steps to Add Key to GitHub

1. **Go to GitHub Settings**
   - Navigate to: https://github.com/settings/keys
   - Or: Click your profile → Settings → SSH and GPG keys

2. **Add New SSH Key**
   - Click "New SSH key" button
   - Title: `Universal AI Tools Dev - macOS`
   - Key type: `Authentication Key`
   - Key: Paste the public key above
   - Click "Add SSH key"

3. **Test the Connection**
   Once you've added the key, run:
   ```bash
   ssh -T git@github.com
   ```
   You should see: "Hi Cmerrill1713! You've successfully authenticated..."

## Switch Repository to SSH

After adding the key to GitHub, run these commands:

```bash
# Switch to SSH URL
git remote set-url origin git@github.com:Cmerrill1713/universal-ai-tools.git

# Verify the change
git remote -v

# Push your branch
git push origin feature/operational-readiness-clean
```

## Current Branch Status

You're on branch: `feature/operational-readiness-clean`

Ready to push these commits:
- Frontend consolidation (archived duplicates)
- Claude Code Swift integration 
- Build optimization scripts
- Repository cleanup

## Alternative: Personal Access Token

If you prefer using HTTPS with a token:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: `Universal AI Tools Push`
4. Select scopes:
   - ✅ repo (all)
   - ✅ workflow
5. Generate token and copy it
6. Use it:
   ```bash
   git remote set-url origin https://YOUR_TOKEN@github.com/Cmerrill1713/universal-ai-tools.git
   git push origin feature/operational-readiness-clean
   ```

## Quick Commands After Setup

```bash
# Test SSH connection
ssh -T git@github.com

# Push current branch
git push origin feature/operational-readiness-clean

# Check status
git status
git log --oneline -5
```

## Troubleshooting

If SSH doesn't work:
```bash
# Start SSH agent
eval "$(ssh-agent -s)"

# Add the key
ssh-add ~/.ssh/id_ed25519_github

# Test again
ssh -T git@github.com
```

## Your Branch is Ready

All changes are committed locally. Once you add the SSH key to GitHub, you can push immediately and continue working on the same branch.