# Universal AI Tools - Testing Checklist

## 🚀 Quick Start
1. Run `./start-dev.sh` to start both backend and frontend
2. Run `./test-full-stack.sh` to verify services are running
3. Open http://localhost:3000 in your browser

## 📋 Manual Testing Checklist

### 1. Initial Load & Navigation
- [ ] Application loads without errors
- [ ] Navigation bar displays correctly
- [ ] Logo and branding appear properly
- [ ] All navigation links work
- [ ] Active route is highlighted
- [ ] Page transitions are smooth

### 2. Chat Interface
- [ ] Chat page loads successfully
- [ ] Empty state shows welcome message
- [ ] Suggested prompts are clickable
- [ ] Input field accepts text
- [ ] Send button enables/disables correctly
- [ ] Enter key sends message
- [ ] Messages appear in chat history
- [ ] User messages align right, AI messages align left
- [ ] Timestamps display correctly
- [ ] Code blocks render with syntax highlighting
- [ ] Copy code button works
- [ ] File upload button is visible
- [ ] Voice input button is visible (placeholder)

### 3. API Integration
- [ ] Health check shows "Connected" status
- [ ] Messages are sent to backend
- [ ] Responses are received from backend
- [ ] Error messages display when API fails
- [ ] Loading states show during requests
- [ ] Conversation ID is maintained

### 4. UI Components (React Spectrum)
- [ ] Buttons have hover effects
- [ ] Icons display correctly (Untitled UI)
- [ ] Tooltips appear on hover
- [ ] Theme is applied consistently
- [ ] Dark mode styling works

### 5. Other Pages
- [ ] Task Execution page loads
- [ ] Agent Activity Monitor page loads
- [ ] Agent Performance page loads
- [ ] All pages maintain consistent styling

### 6. Responsive Design
- [ ] Test on desktop (1920x1080)
- [ ] Test on laptop (1366x768)
- [ ] Test on tablet (768x1024)
- [ ] Test on mobile (375x667)
- [ ] Navigation adapts to screen size
- [ ] Chat interface remains usable on mobile

### 7. Performance
- [ ] Page loads quickly (< 3 seconds)
- [ ] Typing in chat input is responsive
- [ ] Scrolling is smooth
- [ ] No visible lag when sending messages
- [ ] Animations are smooth (60 fps)

### 8. Error Handling
- [ ] Graceful handling of network errors
- [ ] Clear error messages
- [ ] Retry mechanisms work
- [ ] No console errors during normal use

### 9. Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 10. Security
- [ ] API key is not exposed in browser
- [ ] No sensitive data in local storage
- [ ] HTTPS works in production
- [ ] CORS is properly configured

## 🔧 Troubleshooting

### Backend Not Starting
1. Check if port 9999 is already in use: `lsof -i :9999`
2. Ensure all dependencies are installed: `npm install`
3. Check environment variables: `cp .env.example .env`

### Frontend Not Starting
1. Navigate to UI directory: `cd ui`
2. Install dependencies: `npm install`
3. Check if port 3000 is in use: `lsof -i :3000`

### API Connection Issues
1. Verify backend is running: `curl http://localhost:9999/health`
2. Check CORS configuration
3. Verify API key in frontend matches backend

### UI Components Not Rendering
1. Check browser console for errors
2. Verify all packages installed correctly
3. Clear browser cache
4. Try incognito/private mode

## 📊 Test Results

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Server | ⏳ | Not tested |
| Frontend Server | ⏳ | Not tested |
| API Health | ⏳ | Not tested |
| Chat UI | ⏳ | Not tested |
| Navigation | ⏳ | Not tested |
| Responsive Design | ⏳ | Not tested |
| Performance | ⏳ | Not tested |

## 🐛 Known Issues
- [ ] List any bugs found during testing

## 📝 Notes
- Add any additional observations or suggestions here