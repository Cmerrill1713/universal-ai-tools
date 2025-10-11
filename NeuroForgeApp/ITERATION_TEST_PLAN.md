# ITERATION TEST PLAN - Production Mode Verification
**Date:** 2025-10-11  
**Build:** v1.0.0 (post-fix)  
**Backend:** ✅ Healthy (localhost:8888)

---

## 🎯 TEST OBJECTIVES

1. Verify production mode launches correctly (not SimpleChatView)
2. Confirm Enter key works 100% reliably
3. Validate Shift+Enter multiline support
4. Test focus management (automatic, no loss)
5. Verify all features still work (camera, mic, TTS, etc.)
6. Confirm QA mode toggle still functions
7. Validate ChatComposer integration
8. Test error handling and recovery

---

## 📋 TEST CASES

### CATEGORY 1: App Launch & Architecture
**Expected:** LoginView → ContentView (NOT SimpleChatView)

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T1.1 | Default Launch | `swift run` | LoginView appears | 🔄 |
| T1.2 | Profile Selection | Select existing profile | ContentView loads | 🔄 |
| T1.3 | Profile Display | Check header | Shows profile name & avatar | 🔄 |
| T1.4 | Backend Connection | Wait 2s | Connection indicator shows | 🔄 |

---

### CATEGORY 2: Keyboard Input (Critical)
**Expected:** Enter works every time, Shift+Enter adds newlines

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T2.1 | Enter Key (Compact) | Type "hello", press Enter | Message sends immediately | 🔄 |
| T2.2 | Enter Key (Full) | Type "hello", press Enter | Message sends immediately | 🔄 |
| T2.3 | Shift+Enter (Compact) | Type "line1", Shift+Enter, "line2" | Newline inserted, no send | 🔄 |
| T2.4 | Shift+Enter (Full) | Type "line1", Shift+Enter, "line2" | Newline inserted, no send | 🔄 |
| T2.5 | ⌘+Enter | Type "hello", press ⌘+Enter | Message sends | 🔄 |
| T2.6 | Empty Message | Press Enter on empty field | Nothing happens (correct) | 🔄 |
| T2.7 | Rapid Enter | Type, Enter, type, Enter (fast) | Both send correctly | 🔄 |

---

### CATEGORY 3: Focus Management
**Expected:** Focus automatic, never lost

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T3.1 | Initial Focus | App launches, load ContentView | Input has focus automatically | 🔄 |
| T3.2 | After Send | Send message, wait for response | Focus returns to input | 🔄 |
| T3.3 | Window Switch | Switch to another app and back | Focus restored to input | 🔄 |
| T3.4 | ⌘L Shortcut | Press ⌘L | Focus forced to input | 🔄 |
| T3.5 | After Camera | Use camera, send image | Focus back to input | 🔄 |
| T3.6 | After Voice | Use voice, complete recording | Focus back to input | 🔄 |

---

### CATEGORY 4: Message Handling
**Expected:** All message types work correctly

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T4.1 | Simple Message | "What is 2+2?" | Response appears with "4" | 🔄 |
| T4.2 | Multiline Message | "Tell me about:\n- AI\n- ML" | Response addresses both | 🔄 |
| T4.3 | Layout Command | "Make buttons bigger" | Layout updates, confirmation | 🔄 |
| T4.4 | Layout Info | "What is the current layout?" | Layout details returned | 🔄 |
| T4.5 | Layout Reset | "Reset layout" | Layout resets, confirmation | 🔄 |
| T4.6 | Long Message | Type 500+ chars, send | Handles correctly | 🔄 |
| T4.7 | Special Chars | "Test: @#$%^&*()" | Sends correctly | 🔄 |

---

### CATEGORY 5: Feature Integration
**Expected:** All existing features still work

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T5.1 | Camera Button | Click camera icon | Image picker opens | 🔄 |
| T5.2 | Image Upload | Select image, analyze | Image sent, AI responds | 🔄 |
| T5.3 | Mic Button | Click mic icon | Recording starts | 🔄 |
| T5.4 | Voice Input | Record, stop | Transcript appears | 🔄 |
| T5.5 | TTS (if enabled) | Enable voice, send message | AI speaks response | 🔄 |
| T5.6 | Message History | Scroll up | Previous messages visible | 🔄 |
| T5.7 | Loading State | Send message | Input disabled during load | 🔄 |

---

### CATEGORY 6: UI Components
**Expected:** ChatComposer behaves correctly

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T6.1 | Placeholder | Clear input field | "Type your message..." shows | 🔄 |
| T6.2 | Text Entry | Type characters | Characters appear | 🔄 |
| T6.3 | Auto-expand | Type long text | Input expands (min 60, max 120) | 🔄 |
| T6.4 | Send Button | Click send button | Message sends | 🔄 |
| T6.5 | Send Button Disabled | Empty input | Send button grayed out | 🔄 |
| T6.6 | Loading Spinner | Send message | Button shows loading indicator | 🔄 |

---

### CATEGORY 7: QA Mode Toggle
**Expected:** Can switch between production and QA modes

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T7.1 | Start in Production | `swift run` | ContentView loads | 🔄 |
| T7.2 | Toggle to QA | Press ⌘⇧Q | SimpleChatView loads | 🔄 |
| T7.3 | QA Mode Works | Type message in QA mode | Works correctly | 🔄 |
| T7.4 | Toggle Back | Press ⌘⇧Q again | ContentView loads | 🔄 |
| T7.5 | QA Mode Launch | `QA_MODE=1 swift run` | SimpleChatView loads directly | 🔄 |

---

### CATEGORY 8: Error Handling
**Expected:** Graceful handling, no crashes

| ID | Test | Steps | Expected Result | Status |
|---|---|---|---|---|
| T8.1 | Backend Down | Stop backend, send message | Error message, no crash | 🔄 |
| T8.2 | Network Timeout | Send message (simulate slow) | Timeout handled gracefully | 🔄 |
| T8.3 | Invalid Response | (Backend returns bad data) | Error message, no crash | 🔄 |
| T8.4 | Rapid Sends | Send 5 messages quickly | All queued correctly | 🔄 |

---

## 🎯 ACCEPTANCE CRITERIA

**MUST PASS (Critical):**
- ✅ T1.1-T1.4: App launches correctly
- ✅ T2.1-T2.7: Keyboard input 100% reliable
- ✅ T3.1-T3.2: Focus automatic and retained

**SHOULD PASS (High Priority):**
- ✅ T4.1-T4.7: Message handling works
- ✅ T5.1-T5.7: Features integrated correctly
- ✅ T6.1-T6.6: UI components function

**NICE TO HAVE:**
- ✅ T7.1-T7.5: QA mode toggle
- ✅ T8.1-T8.4: Error handling

**Pass Threshold:** 90% (minimum 27/30 tests)

---

## 📊 TEST EXECUTION

### Manual Testing Protocol:
1. Launch app: `swift run`
2. Execute tests in order
3. Mark each result: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL
4. Document any failures with screenshots
5. Generate final report

### Automated Testing (where applicable):
- Unit tests: `swift test`
- Accessibility: Check all IDs present
- Memory: Monitor for leaks during long session

---

## 🚀 EXECUTION LOG

**Start Time:** [To be filled]  
**Tester:** QA Engineer (automated)  
**Environment:**
- macOS: 14.x
- Swift: 5.9+
- Backend: localhost:8888 ✅ Healthy
- Build: 1.54s ✅ Clean

**Results:** [To be filled after execution]

---

*Test Plan Generated: 2025-10-11*  
*Status: READY TO EXECUTE*  
*Estimated Time: 15 minutes*

