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
  ExclamationTriangleIcon,
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
  const [evaluationMode, setEvaluationMode] = useState(false);
  const [subjectUser, setSubjectUser] = useState('');
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<ChatMessage | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamingMessage]);

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

    // Validation for evaluation mode
    if (evaluationMode && !subjectUser.trim()) {
      toast.error('Subject user is required for evaluation mode');
      return;
    }

    const question = inputValue.trim();
    setInputValue('');

    // Create user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    onNewMessage?.(userMessage);

    // Create initial assistant message
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    };

    setCurrentStreamingMessage(assistantMessage);
    setIsStreaming(true);

    try {
      // Debug: Check if api object is available
      console.log('API object:', api);
      console.log('API conversations:', api?.conversations);
      
      const queryRequest: QueryRequest = {
        client_id: clientId,
        conversation_id: conversationId,
        question,
        evaluation_mode: evaluationMode,
        subject_user: evaluationMode ? subjectUser.trim() : undefined,
        filters: {
          // Add default filters or get from UI
        },
      };

      console.log('Query request:', queryRequest);
      console.log('Calling api.conversations.query...');

      const handlers = {
        onConnected: (data) => {
          console.log('Connected to stream:', data);
        },

        onMeta: (meta: SSEMetaEvent) => {
          console.log('Meta received:', meta);
          // Update UI with meta information if needed
        },

        onToken: (token: string) => {
          setCurrentStreamingMessage(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              content: prev.content + token,
            };
          });
        },

        onCitations: (citations: CitationDto[]) => {
          setCurrentStreamingMessage(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              citations,
            };
          });
        },

        onEvaluationPayload: (evaluation: EvaluationPayload) => {
          setCurrentStreamingMessage(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              evaluation,
            };
          });
        },

        onDone: (data: SSEDoneEvent) => {
          console.log('Stream completed:', data);
          
          if (currentStreamingMessage) {
            const finalMessage: ChatMessage = {
              ...currentStreamingMessage,
              streaming: false,
            };
            
            setMessages(prev => [...prev, finalMessage]);
            onNewMessage?.(finalMessage);
          }
          
          setCurrentStreamingMessage(null);
          setIsStreaming(false);
          abortControllerRef.current = null;
        },

        onError: (error) => {
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

      console.log('Handlers object:', handlers);
      console.log('Calling with handlers...');

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
      
      if (currentStreamingMessage) {
        const stoppedMessage: ChatMessage = {
          ...currentStreamingMessage,
          content: currentStreamingMessage.content + '\n\n*Response was stopped by user.*',
          streaming: false,
        };
        
        setMessages(prev => [...prev, stoppedMessage]);
        onNewMessage?.(stoppedMessage);
      }
      
      setCurrentStreamingMessage(null);
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
      {/* Evaluation Mode Toggle */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={evaluationMode}
              onChange={(e) => setEvaluationMode(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-[#ffe600] focus:ring-[#ffe600]"
            />
            <span className="text-sm font-medium">Evaluation Mode</span>
          </label>
          
          {evaluationMode && (
            <input
              type="text"
              placeholder="Subject user (required)"
              value={subjectUser}
              onChange={(e) => setSubjectUser(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
            />
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {currentStreamingMessage && (
          <MessageBubble message={currentStreamingMessage} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex space-x-2">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the chat data..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] resize-none"
              rows={1}
              disabled={isStreaming}
            />
          </div>
          
          {isStreaming ? (
            <Button
              onClick={handleStopStream}
              variant="outline"
              className="px-4 py-3 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <StopIcon className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || (evaluationMode && !subjectUser.trim())}
              className="px-4 py-3"
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
        "max-w-[80%] rounded-2xl px-4 py-3",
        message.type === 'user'
          ? "bg-[#ffe600] text-black"
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
      )}>
        <div className="whitespace-pre-wrap">
          {message.content}
          {message.streaming && (
            <span className="inline-block w-2 h-5 bg-current animate-pulse ml-1" />
          )}
        </div>
        
        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Sources:</div>
            <div className="flex flex-wrap gap-2">
              {message.citations.map((citation) => (
                <CitationChip key={citation.chunk_id} citation={citation} />
              ))}
            </div>
          </div>
        )}
        
        {/* Evaluation Results */}
        {message.evaluation && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
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
      {citation.room_name}
    </div>
  );
}

function EvaluationScorecard({ evaluation }: { evaluation: EvaluationPayload }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 dark:text-white">
          Evaluation Results
        </h4>
        <div className="text-right">
          <div className="text-lg font-bold text-[#ffe600]">
            {evaluation.summary.weighted_total.toFixed(1)}/5.0
          </div>
          <div className="text-xs text-gray-500 capitalize">
            {evaluation.summary.confidence} confidence
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        {evaluation.drivers.map((driver) => (
          <div key={driver.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {driver.name}
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-[#ffe600] h-2 rounded-full"
                  style={{ width: `${(driver.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">
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
          <ul className="text-sm space-y-1">
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
