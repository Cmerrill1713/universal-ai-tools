# AI Assistant Discovery Protocol

## Mandatory Process for Every New Conversation

### 🛡️ CRITICAL: Follow This Protocol Every Time

**This protocol prevents duplication of work and ensures we build on existing implementations rather than starting from scratch.**

---

## 📋 MANDATORY DISCOVERY CHECKLIST

### 1. SYSTEM OVERVIEW (2-3 minutes)

```bash
# Get the big picture first
ls -la                    # Project structure
cat README.md            # Project overview
cat README-SYSTEM.md     # System architecture
./status-go-rust.sh      # What's running?
docker ps               # Container status
```

### 2. SERVICE INVENTORY (5 minutes)

```bash
# Map all services before doing anything
find . -name "main.go" -o -name "main.rs" -o -name "index.js" | head -20
netstat -tulpn | grep LISTEN | grep -E "80[0-9][0-9]|30[0-9][0-9]"
ps aux | grep -E "(go|rust|node)" | grep -v grep
```

### 3. HEALTH STATUS CHECK (3 minutes)

```bash
# Test what's working
curl -s http://localhost:8080/health
curl -s http://localhost:8015/health
curl -s http://localhost:3033/health
curl -s http://localhost:8017/health
```

### 4. CURRENT STATE REVIEW (5 minutes)

```bash
# Check recent changes and current issues
git log --oneline -5
git status
grep -r "TODO\|FIXME\|BUG" . --include="*.go" --include="*.rs" | head -10
```

### 5. CONFIGURATION CHECK (3 minutes)

```bash
# Check environment and config
cat .env | grep -E "(PORT|URL|HOST|DATABASE)"
cat supabase/config.toml | head -20
```

---

## 🚨 BEFORE ANY ACTION - VERIFICATION CHECKLIST

### Before Creating ANY Service:

- ✅ **Service Exists?** - Is this already implemented?
- ✅ **Port Available?** - Is this port already in use?
- ✅ **Documented?** - Is this service already documented?
- ✅ **Running?** - Is this service already running?

### Before Fixing ANY Error:

- ✅ **Real Error?** - Is this actually broken or by design?
- ✅ **Already Fixed?** - Was this recently addressed?
- ✅ **Known Issue?** - Is this a documented problem?
- ✅ **Intentional?** - Is this behavior expected?

### Before Implementing ANY Feature:

- ✅ **Already Implemented?** - Does this feature exist elsewhere?
- ✅ **Similar Pattern?** - How are similar features implemented?
- ✅ **Integration Points?** - What services need to be updated?
- ✅ **Configuration Needed?** - What environment variables are required?

---

## 🎯 DISCOVERY TEMPLATE

```
CONVERSATION START CHECKLIST:
├── System Overview (README, structure)
├── Service Inventory (ports, processes, containers)
├── Health Status (what's working vs. broken)
├── Recent Changes (git log, current state)
├── Known Issues (TODOs, FIXMEs, bugs)
└── Configuration (environment, config files)

BEFORE ANY ACTION:
├── Does this already exist?
├── Is this already running?
├── Is this already documented?
├── Is this already fixed?
└── Is this intentional behavior?
```

---

## 🚨 RED FLAGS TO WATCH FOR

### Before Creating:

- ❌ "I need to create a new service" → ✅ "Let me check if one exists first"
- ❌ "This feature is missing" → ✅ "Let me verify it's not implemented elsewhere"
- ❌ "I'll build this from scratch" → ✅ "Let me see what's already there"

### Before Fixing:

- ❌ "This is broken" → ✅ "Let me check if it's supposed to work this way"
- ❌ "I need to fix this error" → ✅ "Let me see if this is a known issue"
- ❌ "This needs to be implemented" → ✅ "Let me check if it's already done"

---

## 💡 KEY PRINCIPLES

1. **"Discover first, act second"** - Never assume what exists
2. **"Build on existing"** - Leverage what's already implemented
3. **"Verify before fixing"** - Confirm issues are real before addressing
4. **"Check before creating"** - Ensure we're not duplicating work
5. **"Understand before changing"** - Know the system before modifying

---

## 📝 EXAMPLE WORKFLOW

**When asked to "fix the database connection":**

1. **First** - Run `./status-go-rust.sh` to see what's running
2. **Second** - Check `curl http://localhost:8017/health` to see the actual error
3. **Third** - Verify `psql` connection to confirm database is accessible
4. **Fourth** - Check `.env` files to see current configuration
5. **Fifth** - Only then propose the specific fix needed

**This prevents:**

- Creating a new database service when one exists
- Fixing a connection that's already working
- Missing the real issue (configuration vs. code)
- Duplicating work that was already done

---

## 🎉 COMMITMENT

**Every new conversation, I will:**

1. **Start with discovery** - Never assume what exists
2. **Map the landscape** - Understand the full system
3. **Check what's working** - Verify current state
4. **Identify what's broken** - Find real issues
5. **Avoid duplication** - Never recreate existing work
6. **Build on existing** - Leverage what's already there

**This ensures we never waste time duplicating work or fixing non-issues.**

---

## 📚 REFERENCE COMMANDS

### Quick System Check:

```bash
./status-go-rust.sh && docker ps && curl -s http://localhost:8080/health
```

### Service Discovery:

```bash
find . -name "main.*" | head -20 && netstat -tulpn | grep LISTEN
```

### Health Check:

```bash
for port in 8080 8015 3033 8017; do echo "Port $port:"; curl -s http://localhost:$port/health; done
```

### Current State:

```bash
git log --oneline -5 && git status && grep -r "TODO\|FIXME" . --include="*.go" --include="*.rs" | head -5
```

---

**This protocol is MANDATORY for every new conversation to prevent duplication of effort and ensure we build on existing implementations.**

