# Universal AI Tools - Git Hooks System

This directory contains documentation for the Git hooks system implemented for the Universal AI Tools platform.

## 🎯 **Hook Overview**

The Universal AI Tools platform uses comprehensive Git hooks to ensure code quality, security, and architectural consistency across the sophisticated AI system.

### **Implemented Hooks:**

1. **`pre-commit`** - Code quality and security validation
2. **`commit-msg`** - Commit message standards and context awareness  
3. **`post-commit`** - Automated optimization and monitoring
4. **`pre-push`** - Final validation before remote push

## 🛡️ **Pre-commit Hook**

**Purpose**: Comprehensive validation before any commit is allowed

**Validations Performed:**
- **Security Checks**: Scans for API keys, secrets, and sensitive data
- **Architecture Compliance**: Ensures context injection service usage
- **Code Quality**: TypeScript compilation, ESLint, Prettier formatting
- **Universal AI Tools Specific**: CLAUDE.md compliance, PRP patterns
- **Performance**: Large file detection, debug statement warnings

**Key Features:**
- ✅ **Mandatory Context Injection**: Blocks commits with LLM calls that don't use `contextInjectionService`
- ✅ **Secret Detection**: Prevents accidental API key commits (promotes Supabase Vault usage)
- ✅ **Auto-formatting**: Automatically formats code and re-stages files
- ✅ **Service-Oriented Validation**: Ensures architectural consistency

**Example Output:**
```bash
🔍 Universal AI Tools Pre-commit Validation
==========================================
📁 Staged files: 3

🛡️  Security Validation
   ✅ Security checks passed

🏗️  Architecture Validation  
   ✅ Architecture validation passed

📝 Code Quality Checks
   ✅ TypeScript compilation passed
   ✅ ESLint passed
   🔧 Auto-formatting files...
   ✅ Code formatted and re-staged

🤖 Universal AI Tools Validation
   ✅ Universal AI Tools validation passed

🎉 Pre-commit validation completed successfully!
```

## 📝 **Commit Message Hook**

**Purpose**: Ensures meaningful commit messages with context awareness

**Features:**
- **Format Suggestions**: Recommends conventional commit format (optional)
- **Context Awareness**: Suggests relevant keywords based on changed files
- **Length Validation**: Prevents too short or too long messages
- **Universal AI Tools Context**: Provides platform-specific guidance

**Smart Suggestions:**
- Changes to `src/services/context*` → Suggests mentioning "context"
- Changes to `src/services/mlx*` → Suggests mentioning "MLX"
- Changes to `supabase/migrations/` → Suggests mentioning "migration"
- Changes to `src/agents/` → Suggests mentioning "agent"
- Changes to `PRPs/` → Suggests mentioning "PRP"

## 🚀 **Post-commit Hook**

**Purpose**: Automated optimization and system monitoring after successful commits

**Automated Actions:**
- **Context System Optimization**: Detects context-related changes
- **MLX Integration Monitoring**: Tracks ML/AI feature changes
- **Database Migration Tracking**: Logs and validates schema changes
- **Agent & Service Monitoring**: Tracks core system modifications
- **PRP Template Sync**: Manages template system updates
- **Security Monitoring**: Logs security-related changes
- **Performance Analysis**: Identifies performance-critical changes
- **Documentation Sync**: Validates CLAUDE.md consistency
- **Deployment Preparation**: Generates checklists for production pushes

**Smart Recommendations:**
```bash
🧠 Context System Optimization
   Context-related files changed - optimization recommended
   💡 Consider running: npm run context:optimize

🔬 MLX Integration Check
   MLX-related changes detected
   💡 Consider running: npm run mlx:test
```

## 🔐 **Pre-push Hook**

**Purpose**: Final comprehensive validation before pushing to remote

**Production Branch Protection:**
- **Full Test Suite**: Runs complete test suite for main/master branches
- **Production Build**: Verifies build succeeds
- **Migration Validation**: Ensures database consistency

**Security & Architecture:**
- **Final Secret Scan**: Scans entire commit history being pushed
- **Context Injection Compliance**: Validates architectural patterns
- **Performance Impact Assessment**: Identifies potentially expensive changes
- **Dependency Security**: Runs npm audit for package changes

**AI Platform Specific:**
- **Supabase Integration**: Validates database and service consistency
- **MLX Feature Validation**: Ensures AI features are properly tested
- **Commit Quality**: Validates conventional commit format

## 🔧 **Configuration & Customization**

### **Environment Variables**
No additional environment variables required - hooks work with existing Universal AI Tools configuration.

### **Bypassing Hooks (Emergency Only)**
```bash
# Skip pre-commit (NOT RECOMMENDED)
git commit --no-verify

# Skip pre-push (NOT RECOMMENDED)  
git push --no-verify
```

### **Hook Maintenance**
```bash
# Test hooks without committing
.git/hooks/pre-commit

# Validate hook syntax
bash -n .git/hooks/pre-commit

# Update hook permissions
chmod +x .git/hooks/*
```

## 📊 **Monitoring & Logs**

**Generated Reports:**
- `logs/migration-status-*.log` - Database migration tracking
- `logs/deployment-checklist-*.md` - Production deployment checklists  
- `logs/commit-health-*.log` - System health monitoring
- `logs/push-report-*.log` - Push validation audit trail

**Performance Impact:**
- Pre-commit: ~5-15 seconds (includes auto-formatting)
- Commit-msg: ~1-2 seconds
- Post-commit: ~2-5 seconds (mostly background)
- Pre-push: ~10-30 seconds (depending on branch and changes)

## 🎯 **Benefits for Universal AI Tools**

### **Security:**
- **Zero Secret Commits**: Prevents API keys from entering repository
- **Promotes Supabase Vault**: Enforces secure secret management
- **Audit Trail**: Complete log of all validation activities

### **Architecture:**
- **Context Injection Compliance**: Ensures all LLM calls are secure and consistent
- **Service-Oriented Enforcement**: Maintains architectural patterns
- **MLX Integration**: Validates advanced AI feature consistency

### **Quality:**
- **Consistent Formatting**: Auto-formats all code
- **Build Validation**: Prevents broken code from entering repository
- **Test Coverage**: Ensures comprehensive testing for production

### **Productivity:**
- **Smart Suggestions**: Context-aware recommendations
- **Automated Optimization**: Background system improvements
- **Documentation Sync**: Maintains up-to-date project documentation

## 🛠️ **Troubleshooting**

### **Common Issues:**

**Hook fails with permission error:**
```bash
chmod +x .git/hooks/*
```

**TypeScript compilation fails:**
```bash
npm run build
# Fix errors, then retry commit
```

**Context injection violation:**
```bash
# Ensure LLM calls use context injection:
const { enrichedPrompt } = await contextInjectionService.enrichWithContext(
  userRequest, 
  { userId, workingDirectory }
);
```

**ESLint failures:**
```bash
npm run lint:fix
git add .
# Retry commit
```

### **Hook Development:**
To modify or extend hooks, edit the files in `.git/hooks/` and ensure they remain executable. Test thoroughly before deploying to production.

---

**The Universal AI Tools Git hooks system ensures that every commit maintains the high standards required for a production AI platform with advanced security, architectural consistency, and code quality.**