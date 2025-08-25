# Stage 4: Frontend-to-Edge Functions Integration

This document outlines the complete integration between the Next.js frontend and Supabase Edge Functions.

## 🚀 Implementation Overview

### **✅ Completed Integrations**

#### **1. API Client Infrastructure**
- **File**: `lib/api-client.ts`
- **Features**:
  - JWT authentication with automatic token attachment
  - Server-Sent Events (SSE) support for streaming
  - Comprehensive error handling with user-friendly messages
  - Retry logic with exponential backoff
  - File upload utilities with SHA-256 calculation
  - Correlation ID tracking for debugging

#### **2. API Services Layer**
- **File**: `lib/api-services.ts`
- **Features**:
  - Organized service functions for each endpoint
  - TypeScript-first with comprehensive type definitions
  - File validation utilities
  - Query validation helpers
  - Complete upload flow orchestration

#### **3. TypeScript API Types**
- **File**: `types/api.ts`
- **Features**:
  - Complete type definitions for all API requests/responses
  - SSE event types
  - Error handling types
  - Upload progress tracking types

## 🔧 **Connected Features**

### **Client Management**
- ✅ **Create Client**: Real API integration in `app/clients/page.tsx`
- ✅ **Error Handling**: User-friendly error messages
- ✅ **Success Feedback**: Toast notifications on success

### **Room Management**
- ✅ **Create Room**: Real API integration in `app/clients/[clientId]/rooms/page.tsx`
- ✅ **Type Validation**: Proper room type handling
- ✅ **Form Validation**: Client-side validation with API error mapping

### **File Upload System**
- ✅ **Upload Widget**: Real API integration in `components/ui/UploadWidget.tsx`
- ✅ **SHA-256 Calculation**: Client-side file digest calculation
- ✅ **Multi-step Upload**: Upload URL → File Upload → Ingestion confirmation
- ✅ **Progress Tracking**: Real-time upload progress
- ✅ **Error Recovery**: Comprehensive error handling with retry options

### **Job Monitoring**
- ✅ **Jobs List**: Real API integration in `app/clients/[clientId]/jobs/page.tsx`
- ✅ **Real-time Updates**: Supabase real-time subscriptions
- ✅ **Job Retry**: Admin functionality for failed jobs
- ✅ **Filtering**: Status and room-based filtering

### **Chat System with AI Analysis**
- ✅ **Chat Interface**: Complete SSE integration in `components/chat/ChatInterface.tsx`
- ✅ **Streaming Responses**: Real-time AI response streaming
- ✅ **Evaluation Mode**: Driver-based evaluation with scorecard
- ✅ **Citations Display**: Source attribution with clickable chips
- ✅ **Error Recovery**: Stream interruption handling with user feedback

## 🔐 **Security Implementation**

### **Authentication Flow**
```typescript
// JWT token automatically attached to all requests
const response = await api.clients.create({ name: "New Client" });

// SSE connections authenticated
const { abort } = await api.conversations.query(request, handlers);
```

### **Error Handling**
```typescript
// Centralized error message mapping
const errorMessage = getErrorMessage(error);
toast.error(errorMessage); // User-friendly message

// Specific error handling
switch (error.error_code) {
  case 'E_FORBIDDEN_CLIENT':
    // Handle access denied
    break;
  case 'E_DUPLICATE_NAME':
    // Handle duplicate entries
    break;
}
```

### **Real-time Updates**
```typescript
// Supabase real-time subscriptions
const channel = supabase
  .channel(`realtime:jobs:${clientId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'jobs',
    filter: `client_id=eq.${clientId}`,
  }, handleJobUpdate)
  .subscribe();
```

## 📊 **API Integration Status**

| Feature | Endpoint | Status | Notes |
|---------|----------|--------|-------|
| **Create Client** | `POST /clients-create` | ✅ | Full integration with error handling |
| **Create Room** | `POST /rooms-create` | ✅ | Type validation and success feedback |
| **Upload URL** | `POST /upload-url` | ✅ | SHA-256 digest calculation |
| **File Upload** | `PUT <signed-url>` | ✅ | Progress tracking |
| **Confirm Ingest** | `POST /ingest` | ✅ | Job queue confirmation |
| **List Jobs** | `GET /jobs` | ✅ | Real-time updates |
| **Retry Job** | `POST /job-retry` | ✅ | Admin-only functionality |
| **Create Conversation** | `POST /conversations-create` | ✅ | Chat initialization |
| **Stream Query** | `POST /query` (SSE) | ✅ | Full streaming with evaluation |
| **Submit Feedback** | `POST /feedback` | ✅ | Citation feedback |
| **Reindex Data** | `POST /reindex` | ✅ | Admin utility |

## 🎯 **Key Features Implemented**

### **1. Complete Upload Flow**
```typescript
// Orchestrated file upload with progress tracking
const result = await api.uploads.uploadFile(
  clientId, 
  roomId, 
  file,
  (progress) => {
    // Real-time progress updates
    console.log(`${progress.stage}: ${progress.progress}%`);
  }
);
```

### **2. Streaming AI Chat**
```typescript
// Server-Sent Events for real-time AI responses
const { abort } = await api.conversations.query(request, {
  onToken: (token) => appendToMessage(token),
  onCitations: (citations) => displaySources(citations),
  onEvaluationPayload: (evaluation) => showScorecard(evaluation),
  onDone: (data) => finalizeMessage(data),
  onError: (error) => handleError(error),
});
```

### **3. Real-time Job Updates**
```typescript
// Live job status updates via Supabase real-time
useEffect(() => {
  const channel = supabase
    .channel(`realtime:jobs:${clientId}`)
    .on('postgres_changes', { /* config */ }, (payload) => {
      updateJobInList(payload.new);
    })
    .subscribe();
  
  return () => supabase.removeChannel(channel);
}, [clientId]);
```

### **4. Comprehensive Error Handling**
```typescript
// User-friendly error messages
const errorMessages = {
  E_UNAUTHORIZED: 'Please sign in again.',
  E_FORBIDDEN_CLIENT: "You don't have access to this client.",
  E_FORBIDDEN_ROLE: "Your role can't perform this action.",
  E_BAD_INPUT: 'Please fix the highlighted fields.',
  E_DUPLICATE_JOB: 'This file seems already processed.',
  // ... more mappings
};
```

## 🔧 **Environment Setup**

### **Required Environment Variables**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=https://your-project-id.supabase.co/functions/v1
```

### **Development Configuration**
```typescript
// lib/api-client.ts automatically configures:
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
```

## 🧪 **Testing Integration**

### **Manual Testing Checklist**
- [ ] **Authentication**: JWT tokens attached to all requests
- [ ] **Client Creation**: Create client → success toast → UI update
- [ ] **Room Creation**: Create room → success feedback → navigation
- [ ] **File Upload**: Select file → progress bar → completion → job creation
- [ ] **Job Monitoring**: View jobs → real-time updates → retry functionality
- [ ] **Chat System**: Send query → streaming response → citations → evaluation
- [ ] **Error Handling**: Trigger errors → user-friendly messages → recovery options

### **API Testing Commands**
```bash
# Test client creation
curl -X POST "https://your-project-id.supabase.co/functions/v1/clients-create" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Client"}'

# Test streaming query
curl -X POST "https://your-project-id.supabase.co/functions/v1/query" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -N \
  -d '{"client_id": "...", "conversation_id": "...", "question": "Test query"}'
```

## 🚀 **Next Steps**

### **Immediate Tasks**
1. **Environment Setup**: Configure `.env.local` with your Supabase credentials
2. **Deploy Edge Functions**: Use `./deploy-functions.sh` to deploy all functions
3. **Test Integration**: Run through the manual testing checklist
4. **Monitor Performance**: Check real-time updates and streaming performance

### **Production Readiness**
1. **Error Monitoring**: Integrate Sentry or similar for production error tracking
2. **Performance Optimization**: Implement caching strategies
3. **User Feedback**: Add user feedback collection for error scenarios
4. **Documentation**: Create user guides for each feature

## 📈 **Performance Optimizations**

### **Implemented Optimizations**
- ✅ **Request Batching**: Multiple operations combined where possible
- ✅ **Optimistic Updates**: UI updates before API confirmation
- ✅ **Connection Reuse**: Single Supabase client instance
- ✅ **Error Recovery**: Automatic retry with exponential backoff
- ✅ **Stream Management**: Proper SSE connection handling with cleanup

### **Caching Strategy**
- **Jobs**: Real-time updates eliminate need for polling
- **Clients/Rooms**: Could implement TanStack Query for caching
- **Chat History**: Stored in component state during session

## 🔒 **Security Considerations**

### **Implemented Security**
- ✅ **JWT Authentication**: All requests authenticated
- ✅ **CORS Handling**: Proper cross-origin request handling
- ✅ **Error Information**: No sensitive data in error messages
- ✅ **Input Validation**: Client-side and server-side validation
- ✅ **Role-based Access**: UI elements hidden based on user roles

### **Security Best Practices**
- Never expose service role keys in frontend
- All sensitive operations require proper JWT validation
- Error messages don't leak system information
- File uploads validated for type and size
- Real-time subscriptions properly scoped to user access

---

**🎉 Stage 4 Complete!** Your TCIS frontend is now fully integrated with the Supabase Edge Functions, providing a seamless, real-time, and secure user experience!
