## 🚀 Pull Request: [Brief Description]

<!-- 
🤖 This PR template integrates with GitHub's advanced features for automated analysis.
The AI-powered code review workflow will automatically analyze your changes.
-->

### 📋 Change Summary
<!-- Provide a clear, concise description of what this PR does -->

**Type of Change:**
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 🔧 Configuration/build changes
- [ ] 📚 Documentation only changes
- [ ] 🎨 UI/UX improvements

### 🎯 Related Issues
<!-- Link related issues using "Fixes #123" or "Addresses #456" -->
- Fixes # (issue number)
- Related to # (issue number)

### 🧪 Testing Strategy
**How has this been tested?**
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated  
- [ ] Manual testing performed
- [ ] Regression testing completed

**Test Coverage:**
- [ ] New code is covered by tests
- [ ] Existing tests still pass
- [ ] No decrease in overall coverage

### 📊 Frontend-Specific Checklist
<!-- For Electron/React changes -->
- [ ] **Electron Security**: No security regressions (contextIsolation, webSecurity)
- [ ] **React Patterns**: Proper hooks usage and component structure
- [ ] **State Management**: Zustand store updates follow immutable patterns
- [ ] **User Isolation**: Changes respect user-specific localStorage patterns
- [ ] **TypeScript**: Strict type checking passes
- [ ] **Accessibility**: WCAG 2.1 AA compliance maintained
- [ ] **Performance**: No memory leaks or performance regressions

### 🔒 Security Considerations
- [ ] No sensitive data exposed in logs or client code
- [ ] Input validation implemented where needed
- [ ] Authentication/authorization changes reviewed
- [ ] No hardcoded secrets or credentials

### 📱 Cross-Platform Testing
<!-- For Electron frontend changes -->
- [ ] **macOS**: Tested and working
- [ ] **Windows**: Tested and working  
- [ ] **Linux**: Tested and working
- [ ] **High DPI displays**: UI scales correctly

### 🤖 AI Analysis Ready
<!-- These will be automatically checked by our AI workflow -->
- [ ] Code complexity within acceptable limits
- [ ] ESLint rules passing
- [ ] Security vulnerability scan requested
- [ ] TypeScript strict mode compliance

### 📸 Visual Changes
<!-- Include screenshots for UI changes -->
**Before:**
<!-- Screenshot or description of current state -->

**After:** 
<!-- Screenshot or description of new state -->

### ⚡ Performance Impact
<!-- Describe any performance implications -->
- **Bundle Size**: No significant increase / Decreased by X%
- **Runtime Performance**: No impact / Improved by X
- **Memory Usage**: No change / Reduced by X

### 📚 Documentation Updates
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Component documentation updated
- [ ] Architecture diagrams updated

### 🔄 Migration/Deployment Notes
<!-- Any special deployment considerations -->
- [ ] Database migrations required
- [ ] Configuration changes needed
- [ ] Breaking changes documented

---

### 🤖 **Automated Analysis Results**
<!-- This section will be populated by our AI workflows -->
*AI-powered analysis will appear here after CI runs...*

**Code Quality Score:** ⏳ *Analyzing...*  
**Security Score:** ⏳ *Scanning...*  
**Performance Impact:** ⏳ *Measuring...*  

### 👀 Reviewer Focus Areas
<!-- Help reviewers focus on specific areas -->
Please pay special attention to:
- [ ] Business logic changes in: `[specific files/functions]`
- [ ] User experience flow: `[specific user journey]`
- [ ] Integration points: `[specific APIs/services]`
- [ ] Error handling: `[specific error scenarios]`

---

**Ready for Review:** 
- [ ] I have reviewed my own code changes
- [ ] I have tested the changes thoroughly  
- [ ] All CI checks are passing
- [ ] Documentation is updated
- [ ] This PR is ready for AI-assisted review