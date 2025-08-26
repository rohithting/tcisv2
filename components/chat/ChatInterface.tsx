'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { api } from '@/lib/api-services';
import { getErrorMessage } from '@/lib/api-client';
import { createClient } from '@/lib/supabase';
import { 
  ChatMessage, 
  CitationDto, 
  EvaluationPayload, 
  QueryRequest, 
  SSEMetaEvent,
  SSEDoneEvent 
} from '@/types/api';
import {
  PaperAirplaneIcon,
  StopIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface ChatInterfaceProps {
  clientId: string;
  conversationId: string;
  onNewMessage?: (message: ChatMessage) => void;
  className?: string;
}

export function ChatInterface({ 
  clientId, 
  conversationId, 
  onNewMessage,
  className 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<ChatMessage | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track the currently streaming assistant message id to update it in-place
  const streamingMessageIdRef = useRef<number | null>(null);
  const streamingMessageRef = useRef<ChatMessage | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingMessage]);

  // Keep ref in sync with state to avoid stale closures inside SSE handlers
  useEffect(() => {
    streamingMessageRef.current = currentStreamingMessage;
  }, [currentStreamingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const question = inputValue.trim();
    setInputValue('');

    // Create user message
    const userMessage: ChatMessage = {
      id: Date.now(), // Use timestamp as numeric ID
      type: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    onNewMessage?.(userMessage);

    // Create initial assistant message and insert into messages immediately
    const assistantMessage: ChatMessage = {
      id: Date.now() + 1, // Use timestamp + 1 as numeric ID
      type: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
      citations: [],
    };

    streamingMessageIdRef.current = assistantMessage.id;
    setCurrentStreamingMessage(assistantMessage);
    setMessages(prev => [...prev, assistantMessage]);
    setIsStreaming(true);

    try {
      const supabase = createClient();
      const queryRequest: QueryRequest = {
        client_id: parseInt(clientId, 10),
        conversation_id: parseInt(conversationId, 10),
        question,
        filters: {
          // Add default filters or get from UI
        },
      };

      const handlers = {
        onConnected: (data: any) => {
          console.log('Connected to stream:', data);
        },

        onMeta: (meta: SSEMetaEvent) => {
          console.log('Meta received:', meta);
        },

        onToken: (token: string) => {
          // Update the streaming message state
          setCurrentStreamingMessage(prev => {
            if (!prev) return prev;
            return { ...prev, content: prev.content + token };
          });
          // Update the message in the list in-place using the id ref
          const id = streamingMessageIdRef.current;
          if (id != null) {
            setMessages(prev => prev.map(msg =>
              msg.id === id ? { ...msg, content: (msg.content || '') + token } : msg
            ));
          }
        },

        onCitations: (citations: CitationDto[]) => {
          console.log('Citations received:', citations);
          // Update the streaming message state
          setCurrentStreamingMessage(prev => {
            if (!prev) return prev;
            return { ...prev, citations };
          });
          // Update the message in the list in-place using the id ref
          const id = streamingMessageIdRef.current;
          if (id != null) {
            setMessages(prev => prev.map(msg =>
              msg.id === id ? { ...msg, citations } : msg
            ));
          }
        },

        onEvaluationPayload: (evaluation: EvaluationPayload) => {
          setCurrentStreamingMessage(prev => {
            if (!prev) return prev;
            return { ...prev, evaluation };
          });
          const id = streamingMessageIdRef.current;
          if (id != null) {
            setMessages(prev => prev.map(msg =>
              msg.id === id ? { ...msg, evaluation } : msg
            ));
          }
        },

        onDone: (data: SSEDoneEvent) => {
          console.log('Stream completed:', data);
          const id = streamingMessageIdRef.current;
          if (id != null) {
            // Mark the existing assistant message as not streaming
            setMessages(prev => prev.map(msg =>
              msg.id === id ? { ...msg, streaming: false } : msg
            ));
            const latest = streamingMessageRef.current;
            if (latest) {
              onNewMessage?.({ ...latest, streaming: false });
            }
          }
          setCurrentStreamingMessage(null);
          streamingMessageIdRef.current = null;
          setIsStreaming(false);
          abortControllerRef.current = null;
        },

        onError: (error: any) => {
          console.error('Stream error:', error);
          const errorMessage = getErrorMessage(error);
          toast.error(errorMessage);
          
          if (currentStreamingMessage) {
            const erroredMessage: ChatMessage = {
              ...currentStreamingMessage,
              content: currentStreamingMessage.content || 'An error occurred while processing your request.',
              streaming: false,
            };
            
            setMessages(prev => [...prev, erroredMessage]);
          }
          
          setCurrentStreamingMessage(null);
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
      };

      const { abort } = await api.conversations.query(supabase, queryRequest, handlers);
      abortControllerRef.current = abort;

    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
      
      setCurrentStreamingMessage(null);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current();
      abortControllerRef.current = null;
      setIsStreaming(false);
      // Update existing assistant message as stopped
      const id = streamingMessageIdRef.current;
      if (id != null) {
        setMessages(prev => prev.map(msg =>
          msg.id === id ? { ...msg, content: (msg.content || '') + '\n\n*Response was stopped by user.*', streaming: false } : msg
        ));
        const latest = streamingMessageRef.current;
        if (latest) {
          onNewMessage?.({ ...latest, content: latest.content + '\n\n*Response was stopped by user.*', streaming: false });
        }
      }
      setCurrentStreamingMessage(null);
      streamingMessageIdRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages Area - Mobile Optimized */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {currentStreamingMessage && (
          <MessageBubble message={currentStreamingMessage} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Mobile Optimized */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex space-x-2 sm:space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the chat data..."
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] resize-none text-sm sm:text-base min-h-[44px] touch-target"
              rows={1}
              disabled={isStreaming}
            />
          </div>
          
          {isStreaming ? (
            <Button
              onClick={handleStopStream}
              variant="outline"
              className="px-3 sm:px-4 py-3 sm:py-3 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 min-h-[44px] min-w-[44px] touch-target"
            >
              <StopIcon className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="px-3 sm:px-4 py-3 sm:py-3 min-h-[48px] min-w-[48px] touch-target"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={cn(
      "flex",
      message.type === 'user' ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base",
        message.type === 'user'
          ? "bg-[#ffe600] text-black"
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
      )}>
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {message.streaming && (
            <span className="inline-block w-2 h-4 sm:h-5 bg-current animate-pulse ml-1" />
          )}
        </div>
        
        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Sources:</div>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {message.citations.map((citation) => (
                <CitationChip key={citation.chunk_id} citation={citation} />
              ))}
            </div>
          </div>
        )}
        
        {/* Evaluation Results */}
        {message.evaluation && (
          <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-700">
            <EvaluationScorecard evaluation={message.evaluation} />
          </div>
        )}
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: CitationDto }) {
  return (
    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      <InformationCircleIcon className="h-3 w-3 mr-1" />
      <span className="truncate max-w-20">{citation.room_name}</span>
    </div>
  );
}

function EvaluationScorecard({ evaluation }: { evaluation: EvaluationPayload }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-2 sm:space-y-0">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
          Evaluation Results
        </h4>
        <div className="text-left sm:text-right">
          <div className="text-lg sm:text-xl font-bold text-[#ffe600]">
            {evaluation.summary.weighted_total.toFixed(1)}/5.0
          </div>
          <div className="text-xs text-gray-500 capitalize">
            {evaluation.summary.confidence} confidence
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        {evaluation.drivers.map((driver) => (
          <div key={driver.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0">
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              {driver.name}
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-16 sm:w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-[#ffe600] h-2 rounded-full"
                  style={{ width: `${(driver.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-xs sm:text-sm font-medium w-6 sm:w-8 text-right">
                {driver.score.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {evaluation.recommendations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Recommendations:
          </div>
          <ul className="text-xs sm:text-sm space-y-1">
            {evaluation.recommendations.map((rec, index) => (
              <li key={index} className="text-gray-700 dark:text-gray-300">
                • {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
