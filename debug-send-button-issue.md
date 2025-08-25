# 🐛 Debug Guide: Send Button Not Working After 2-3 Minutes Idle

## **🔍 DEBUGGING STEPS**

### **Step 1: Test the Button Click**
1. **Type a message** in the chat input
2. **Wait 2-3 minutes** without doing anything
3. **Click the Send button**
4. **Check browser console** for these logs:

**Expected logs if button click is working:**
```
🖱️ Send button clicked! { newMessage: "your message", disabled: false, isStreaming: false, messageLength: X }
🔥 sendMessage called { newMessage: "your message", selectedConversation: X, isStreaming: false, hasLazyAuth: true }
🔐 Starting session validation...
🔐 lazyAuthenticate called
🔐 Session check result: { hasSession: true, error: false }
🔐 Token expiry check: { now: X, tokenExp: Y, timeUntilExpiry: Z, needsRefresh: false }
🔐 Token is healthy, no refresh needed
🔐 Session validation result: true
✅ Session validation successful, proceeding with message
```

**If you don't see the first log (`🖱️ Send button clicked!`), the issue is:**
- Button click event is not firing
- Button might be disabled
- React event handlers are broken

### **Step 2: Test the Enter Key**
1. **Type a message** in the chat input
2. **Wait 2-3 minutes** without doing anything
3. **Press Enter** (not Shift+Enter)
4. **Check browser console** for these logs:

**Expected logs if Enter key is working:**
```
⌨️ Key pressed: { key: "Enter", shiftKey: false }
⌨️ Enter pressed, calling sendMessage
🔥 sendMessage called { ... }
```

**If you don't see these logs, the issue is:**
- Keyboard event handlers are broken
- Input field has lost focus

### **Step 3: Check Component State**
**Every 30 seconds, you should see this log:**
```
🔍 Component state debug: {
  selectedConversation: "X",
  messagesCount: Y,
  newMessageLength: Z,
  isStreaming: false,
  hasLazyAuth: true,
  timestamp: "..."
}
```

**If `hasLazyAuth` is `false`, the issue is:**
- AuthContext is not providing the `lazyAuthenticate` function
- Component re-rendered and lost the function reference

### **Step 4: Check Session Health**
**You should see this log initially:**
```
🏥 Session health check: Token is healthy
```

**If you see errors here, the session system is broken**

### **Step 5: Visual Button State**
**Check if the Send button:**
- ✅ Is visible and not grayed out
- ✅ Has normal opacity (not 0.5)
- ✅ Cursor changes to pointer when hovering
- ❌ If button looks disabled, check console for disabled state logs

## **🔧 POSSIBLE CAUSES & FIXES**

### **Cause 1: React Event Handlers Lost**
**Symptoms:** No click or keypress logs appear
**Fix:** React component might be re-rendering and losing event handlers
```typescript
// This might be caused by:
// 1. State changes causing unnecessary re-renders
// 2. useEffect dependencies causing component resets
// 3. Context provider re-mounting
```

### **Cause 2: AuthContext Function Lost**
**Symptoms:** `hasLazyAuth: false` in state debug logs
**Fix:** AuthContext might be re-mounting or not providing the function
```typescript
// Check if AuthProvider is wrapping the component properly
// Check if useAuth hook is working correctly
```

### **Cause 3: Button Disabled State Issue**
**Symptoms:** Button appears disabled (grayed out)
**Fix:** Check the disabled condition logic
```typescript
disabled={!newMessage.trim() || newMessage.length > 1000}
// Make sure newMessage state is not corrupted
```

### **Cause 4: Session Health Check Interference**
**Symptoms:** Button stops working exactly when health check runs
**Fix:** The periodic session refresh might be causing state issues
```typescript
// I've temporarily disabled the interval health check
// If this fixes it, we need to adjust the health check logic
```

### **Cause 5: Component Re-mounting**
**Symptoms:** All state resets, selectedConversation becomes null
**Fix:** Check if parent components are causing re-mounts
```typescript
// Look for key prop changes
// Check if router navigation is causing issues
// Check if AuthContext is stable
```

## **🚨 IMMEDIATE TESTS TO RUN**

1. **Open browser console**
2. **Type a message and wait 2-3 minutes**
3. **Try clicking Send button**
4. **Try pressing Enter**
5. **Report back what logs you see (or don't see)**

## **📋 REPORT FORMAT**

Please report back with:
```
BUTTON CLICK TEST:
- Saw "🖱️ Send button clicked!" log: YES/NO
- Saw "🔥 sendMessage called" log: YES/NO
- Button appears disabled: YES/NO

ENTER KEY TEST:
- Saw "⌨️ Key pressed" log: YES/NO
- Saw "⌨️ Enter pressed" log: YES/NO

STATE DEBUG:
- hasLazyAuth value: true/false
- selectedConversation value: number/null
- Any error logs: [paste here]

VISUAL STATE:
- Button appears grayed out: YES/NO
- Button cursor changes on hover: YES/NO
- Input field appears normal: YES/NO
```

This will help me identify exactly where the issue is occurring and fix it accordingly! 🎯
