# 🐛 Debugging "Please sign in again" Error

## **Immediate Debugging Steps**

### **1. Check Browser Console**
Open browser dev tools and look for:
- Token refresh logs
- API call errors
- Network request details

### **2. Verify Environment Variables**
Check your `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-project.supabase.co/functions/v1
```

### **3. Test Edge Function Directly**
```bash
# Test with curl to see if it's a frontend or backend issue
curl -X POST https://your-project.supabase.co/functions/v1/clients-create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"Test"}'
```

### **4. Check Token in Browser**
```javascript
// In browser console, run:
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('Token:', session?.access_token?.substring(0, 20) + '...');
```

## **Common Issues**

### **Issue 1: Wrong API Base URL**
- **Symptom**: 404 errors or wrong endpoint
- **Fix**: Ensure `NEXT_PUBLIC_API_BASE_URL` is correct

### **Issue 2: Token Not Being Sent**
- **Symptom**: Authorization header missing
- **Fix**: Check if `getAuthToken()` is working

### **Issue 3: Edge Function Not Deployed**
- **Symptom**: Function not found errors
- **Fix**: Deploy with `./deploy-secure-functions.sh`

### **Issue 4: User Not in Database**
- **Symptom**: "Platform user not found"
- **Fix**: Check if user exists in `platform_users` table

## **Quick Fix Test**

Add this to your clients page temporarily:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // DEBUG: Check token
  const { data: { session } } = await supabase.auth.getSession();
  console.log('DEBUG - Session exists:', !!session);
  console.log('DEBUG - Token:', session?.access_token?.substring(0, 20) + '...');
  
  // ... rest of your code
};
```

## **Expected Console Output**
If working correctly, you should see:
- `Token expiring soon, refreshing...` (if needed)
- `Token refreshed successfully`
- API call with proper Authorization header
- Success response

## **If Still Failing**
1. **Check network tab** - see actual request/response
2. **Verify Edge Function logs** - check Supabase dashboard
3. **Test with Postman** - isolate frontend vs backend issue
4. **Check user permissions** - ensure user has correct role
