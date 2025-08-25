/**
 * Server-Sent Events (SSE) utilities for streaming responses
 */ export class SSEStream {
  correlationId;
  onClose;
  encoder;
  controller;
  closed;
  constructor(correlationId, onClose){
    this.correlationId = correlationId;
    this.onClose = onClose;
    this.encoder = new TextEncoder();
    this.closed = false;
  }
  /**
   * Create a ReadableStream for SSE
   */ createStream() {
    return new ReadableStream({
      start: (controller)=>{
        this.controller = controller;
        // Send initial headers
        this.sendMessage({
          event: 'connected',
          data: {
            corr_id: this.correlationId,
            timestamp: new Date().toISOString()
          }
        });
      },
      cancel: ()=>{
        this.close();
      }
    });
  }
  /**
   * Create Response with proper SSE headers
   */ createResponse() {
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    if (this.correlationId) {
      headers.set('x-corr-id', this.correlationId);
    }
    return new Response(this.createStream(), {
      status: 200,
      headers
    });
  }
  /**
   * Send a message via SSE
   */ sendMessage(message) {
    if (this.closed || !this.controller) return;
    try {
      let sseData = '';
      if (message.event) {
        sseData += `event: ${message.event}\n`;
      }
      if (message.id) {
        sseData += `id: ${message.id}\n`;
      }
      if (message.retry) {
        sseData += `retry: ${message.retry}\n`;
      }
      // Handle data serialization
      const dataString = typeof message.data === 'string' ? message.data : JSON.stringify(message.data);
      // Split multiline data
      dataString.split('\n').forEach((line)=>{
        sseData += `data: ${line}\n`;
      });
      sseData += '\n';
      this.controller.enqueue(this.encoder.encode(sseData));
    } catch (error) {
      console.error('Error sending SSE message:', error);
      this.close();
    }
  }
  /**
   * Send metadata event
   */ meta(data) {
    this.sendMessage({
      event: 'meta',
      data
    });
  }
  /**
   * Send token event (for streaming text)
   */ token(text) {
    this.sendMessage({
      event: 'token',
      data: text
    });
  }
  /**
   * Send citations event
   */ citations(citations) {
    this.sendMessage({
      event: 'citations',
      data: citations
    });
  }
  /**
   * Send evaluation payload event
   */ evaluationPayload(payload) {
    this.sendMessage({
      event: 'evaluation_payload',
      data: payload
    });
  }
  /**
   * Send error event
   */ error(errorCode, message, details) {
    this.sendMessage({
      event: 'error',
      data: {
        error_code: errorCode,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    });
  }
  /**
   * Send done event and close stream
   */ done(data) {
    this.sendMessage({
      event: 'done',
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    });
    this.close();
  }
  /**
   * Close the stream
   */ close() {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.controller) {
        this.controller.close();
      }
    } catch (error) {
      console.error('Error closing SSE stream:', error);
    }
    if (this.onClose) {
      this.onClose();
    }
  }
  /**
   * Check if stream is closed
   */ isClosed() {
    return this.closed;
  }
}
/**
 * Create SSE response with timeout
 */ export function createSSEResponse(correlationId, timeoutMs = 30000) {
  const stream = new SSEStream(correlationId);
  // Set up timeout
  const timeout = setTimeout(()=>{
    if (!stream.isClosed()) {
      stream.error('E_TIMEOUT', 'Request timeout exceeded');
      stream.close();
    }
  }, timeoutMs);
  // Clear timeout when stream closes
  const originalOnClose = stream['onClose'];
  stream['onClose'] = ()=>{
    clearTimeout(timeout);
    if (originalOnClose) originalOnClose();
  };
  return {
    stream,
    response: stream.createResponse()
  };
}
/**
 * Utility to handle SSE errors gracefully
 */ export function handleSSEError(stream, error, correlationId) {
  console.error('SSE Error:', error, {
    correlationId
  });
  if (!stream.isClosed()) {
    if (error instanceof Response) {
      // Handle thrown Response objects
      error.json().then((errorData)=>{
        stream.error(errorData.error_code || 'E_UNKNOWN', errorData.message || 'Unknown error', errorData.details);
      }).catch(()=>{
        stream.error('E_UNKNOWN', 'Unknown error occurred');
      }).finally(()=>{
        stream.close();
      });
    } else {
      // Handle generic errors
      stream.error('E_INTERNAL_ERROR', error.message || 'Internal server error', {
        error: error.toString()
      });
      stream.close();
    }
  }
}
