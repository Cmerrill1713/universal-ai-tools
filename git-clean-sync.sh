#!/bin/bash

# Git Clean & Sync Script
# Ensures repository is clean and synchronized with GitHub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        Git Repository Clean & Sync${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"

# Function to check if there are uncommitted changes
check_uncommitted() {
    if ! git diff-index --quiet HEAD --; then
        return 0  # Has uncommitted changes
    else
        return 1  # No uncommitted changes
    fi
}

# Function to check if there are untracked files
check_untracked() {
    if [ -n "$(git ls-files --others --exclude-standard)" ]; then
        return 0  # Has untracked files
    else
        return 1  # No untracked files
    fi
}

# 1. Show current status
echo -e "${CYAN}📊 Current Repository Status:${NC}"
echo -e "${YELLOW}Branch:${NC} $(git branch --show-current)"
echo -e "${YELLOW}Remote:${NC} $(git remote -v | head -1)"
echo ""

# 2. Check for uncommitted changes
if check_uncommitted || check_untracked; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes or untracked files:${NC}"
    git status --short
    echo ""
    
    read -p "$(echo -e ${CYAN}"Do you want to (s)tash, (c)ommit, or (d)iscard changes? [s/c/d]: "${NC})" choice
    
    case $choice in
        s|S)
            echo -e "${GREEN}📦 Stashing changes...${NC}"
            git stash push -u -m "Stash before sync - $(date +%Y-%m-%d_%H-%M-%S)"
            echo -e "${GREEN}✅ Changes stashed${NC}"
            ;;
        c|C)
            echo -e "${GREEN}💾 Committing changes...${NC}"
            git add -A
            read -p "Enter commit message: " commit_msg
            git commit -m "$commit_msg"
            echo -e "${GREEN}✅ Changes committed${NC}"
            ;;
        d|D)
            echo -e "${RED}🗑️  Discarding changes...${NC}"
            read -p "$(echo -e ${RED}"Are you SURE? This cannot be undone! [y/N]: "${NC})" confirm
            if [[ $confirm =~ ^[Yy]$ ]]; then
                git reset --hard HEAD
                git clean -fd
                echo -e "${GREEN}✅ Changes discarded${NC}"
            else
                echo -e "${YELLOW}Cancelled${NC}"
                exit 1
            fi
            ;;
        *)
            echo -e "${RED}Invalid choice. Exiting.${NC}"
            exit 1
            ;;
    esac
fi

# 3. Fetch latest from remote
echo -e "\n${CYAN}🔄 Fetching latest from remote...${NC}"
git fetch --all --prune

# 4. Show divergence
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "none")
BASE=$(git merge-base @ @{u} 2>/dev/null || echo "none")

if [ "$REMOTE" = "none" ]; then
    echo -e "${YELLOW}⚠️  No upstream branch set${NC}"
    read -p "Set upstream to origin/$(git branch --show-current)? [y/N]: " set_upstream
    if [[ $set_upstream =~ ^[Yy]$ ]]; then
        git branch --set-upstream-to=origin/$(git branch --show-current)
        REMOTE=$(git rev-parse @{u})
        BASE=$(git merge-base @ @{u})
    fi
fi

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}✅ Branch is up to date with remote${NC}"
elif [ "$LOCAL" = "$BASE" ]; then
    echo -e "${YELLOW}⬇️  Branch is behind remote by $(git rev-list --count $LOCAL..$REMOTE) commits${NC}"
    read -p "Pull latest changes? [Y/n]: " pull_changes
    if [[ ! $pull_changes =~ ^[Nn]$ ]]; then
        git pull --rebase
        echo -e "${GREEN}✅ Pulled latest changes${NC}"
    fi
elif [ "$REMOTE" = "$BASE" ]; then
    echo -e "${YELLOW}⬆️  Branch is ahead of remote by $(git rev-list --count $REMOTE..$LOCAL) commits${NC}"
    read -p "Push changes to remote? [Y/n]: " push_changes
    if [[ ! $push_changes =~ ^[Nn]$ ]]; then
        git push
        echo -e "${GREEN}✅ Pushed changes to remote${NC}"
    fi
else
    echo -e "${RED}🔀 Branch has diverged from remote${NC}"
    echo "Local commits: $(git rev-list --count $BASE..$LOCAL)"
    echo "Remote commits: $(git rev-list --count $BASE..$REMOTE)"
    
    read -p "$(echo -e ${CYAN}"(r)ebase onto remote or (m)erge? [r/m]: "${NC})" merge_choice
    case $merge_choice in
        r|R)
            git pull --rebase
            echo -e "${GREEN}✅ Rebased onto remote${NC}"
            ;;
        m|M)
            git pull --no-rebase
            echo -e "${GREEN}✅ Merged with remote${NC}"
            ;;
        *)
            echo -e "${YELLOW}Skipping sync${NC}"
            ;;
    esac
fi

# 5. Clean up old branches
echo -e "\n${CYAN}🧹 Checking for merged branches to clean...${NC}"
MERGED_BRANCHES=$(git branch --merged | grep -v "\*\|master\|main\|develop" || true)
if [ -n "$MERGED_BRANCHES" ]; then
    echo -e "${YELLOW}Found merged branches:${NC}"
    echo "$MERGED_BRANCHES"
    read -p "Delete these merged branches? [y/N]: " delete_merged
    if [[ $delete_merged =~ ^[Yy]$ ]]; then
        echo "$MERGED_BRANCHES" | xargs -n 1 git branch -d
        echo -e "${GREEN}✅ Deleted merged branches${NC}"
    fi
fi

# 6. Show final status
echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                 Final Status${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Branch:${NC} $(git branch --show-current)"
echo -e "${GREEN}Status:${NC} $(git status --porcelain | wc -l) uncommitted changes"
echo -e "${GREEN}Last commit:${NC} $(git log -1 --pretty=format:'%h - %s (%ar)')"

# 7. Optional: Show stash list
if [ $(git stash list | wc -l) -gt 0 ]; then
    echo -e "\n${YELLOW}📦 Stashed changes:${NC}"
    git stash list | head -5
fi

echo -e "\n${GREEN}✅ Repository sync complete!${NC}"