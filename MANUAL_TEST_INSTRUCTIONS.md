# 🧪 NeuroForge Native App - Manual Testing Instructions

**Your native Swift app is running!**

I can see the NeuroForge AI window on your screen with:
- 🧠 Purple brain icon
- "NeuroForge AI" title
- 🟢 Green "Connected" status
- Welcome message with capabilities
- Input field at the bottom

---

## 🎯 PLEASE TEST THESE MANUALLY:

### Test 1: Simple Chat ✅
**Click** in the "Ask NeuroForge anything..." text field  
**Type:** `What is 456 times 789?`  
**Press:** Enter  
**Expected:** AI responds with "359,784"

### Test 2: Browser Automation ✅
**Type:** `Search Google for Python tutorials`  
**Press:** Enter  
**Expected:** 
- Browser window opens with Google search
- AI responds with summary of results

### Test 3: macOS Control ✅
**Type:** `Open Calculator app`  
**Press:** Enter  
**Expected:** 
- Tool detected message
- Calculator may or may not open (depends on backend mode)

### Test 4: General Question ✅
**Type:** `Tell me about machine learning`  
**Press:** Enter  
**Expected:** AI explains ML concepts

---

## 📊 WHAT TO VERIFY:

While testing, check:
- [ ] Messages appear in chat bubbles (purple for you, gray for AI)
- [ ] Timestamps show on each message
- [ ] "Connected" status stays green
- [ ] Message counter increments
- [ ] Loading indicator appears while AI thinks
- [ ] Responses are complete and make sense

---

## 🐛 IF SOMETHING DOESN'T WORK:

### If input field doesn't respond:
1. Click directly in the text field
2. Make sure the NeuroForge window is active (not another app)
3. Try pressing Tab to focus the field

### If messages don't send:
1. Make sure you press Enter (not just typing)
2. Check the "Connected" status is green
3. Run: `curl http://localhost:8013/health` to verify backend

### If you get errors:
1. Check backend logs: `docker logs unified-ai-assistant-api`
2. Restart app: `pkill NeuroForgeApp && cd NeuroForgeApp && swift run`
3. Restart backend: `docker-compose restart unified-ai-assistant-api`

---

## ✅ WHAT'S BEEN VERIFIED:

### Automated Tests (Backend):
- ✅ Math calculations working
- ✅ Browser automation working
- ✅ General chat working
- ✅ Tool detection working

### App Build:
- ✅ Compiles successfully
- ✅ Launches without errors
- ✅ Window created
- ✅ UI renders correctly

### Integration:
- ✅ Backend running (localhost:8013)
- ✅ macOS service running (localhost:9876)
- ✅ Connection code implemented
- ✅ Request/response format correct

---

## 🎥 TO RECORD YOUR TEST:

I can capture screenshots after each message. Just let me know what you typed and what happened!

Or you can manually screenshot with: ⌘+Shift+4, then click the window

---

## 🚀 CURRENT STATUS:

**App:** ✅ Running (you can see it on screen)  
**Backend:** ✅ Connected  
**Ready for:** Manual testing by you!

**Just click in the input field and start chatting!** 🎉

