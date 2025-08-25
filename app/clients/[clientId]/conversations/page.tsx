'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClientPicker } from '@/components/ui/ClientPicker';
import { Button } from '@/components/ui/Button';
import { EvaluationScorecard } from '@/components/chat/EvaluationScorecard';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { 
  ChatBubbleLeftRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  PaperAirplaneIcon,
  StopIcon,
  FunnelIcon,
  CalendarIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Conversation {
  id: string;
  title: string;
  client_id: string;
  last_activity: string;
  message_count: number;
  created_at: string;
  preview?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Citation[];
  evaluation?: EvaluationResult;
  status?: 'sending' | 'streaming' | 'complete' | 'error';
}

interface Citation {
  id: string;
  room_name: string;
  time_span: string;
  snippet: string;
  chunk_id: string;
}

interface EvaluationResult {
  summary: {
    weighted_total: number;
    confidence: number;
  };
  drivers: Array<{
    name: string;
    weight: number;
    score: number;
    rationale: string;
    citations: Citation[];
  }>;
  recommendations: string[];
  subject_user: string;
  evaluation_timestamp: string;
}

interface ChatFilters {
  types: ('internal' | 'external' | 'both')[];
  room_ids: string[];
  date_from: string;
  date_to: string;
  participants: string[];
  evaluation_mode: boolean;
  subject_user: string;
}

export default function ConversationsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params.clientId as string;
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobileConversationView, setIsMobileConversationView] = useState(false);
  
  const [filters, setFilters] = useState<ChatFilters>({
    types: ['both'],
    room_ids: [],
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    participants: [],
    evaluation_mode: false,
    subject_user: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Mock data
  useEffect(() => {
    const fetchConversations = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockConversations: Conversation[] = [
        {
          id: 'conv_001',
          title: 'Customer Satisfaction Analysis',
          client_id: clientId,
          last_activity: '2 hours ago',
          message_count: 8,
          created_at: '2024-01-20T10:30:00Z',
          preview: 'How satisfied are our customers with the recent product updates?',
        },
        {
          id: 'conv_002',
          title: 'Team Communication Patterns',
          client_id: clientId,
          last_activity: '1 day ago',
          message_count: 12,
          created_at: '2024-01-19T14:15:00Z',
          preview: 'Analyze the communication patterns in our internal team chats',
        },
        {
          id: 'conv_003',
          title: 'Sales Performance Insights',
          client_id: clientId,
          last_activity: '3 days ago',
          message_count: 6,
          created_at: '2024-01-17T09:20:00Z',
          preview: 'What insights can we gather from sales team conversations?',
        },
      ];
      
      setConversations(mockConversations);
      setLoading(false);
    };

    fetchConversations();
  }, [clientId]);

  // Load messages for selected conversation
  useEffect(() => {
    if (selectedConversation) {
      const mockMessages: Message[] = [
        {
          id: 'msg_001',
          conversation_id: selectedConversation,
          role: 'user',
          content: 'How satisfied are our customers with the recent product updates?',
          timestamp: '2024-01-20T10:30:00Z',
          status: 'complete',
        },
        {
          id: 'msg_002',
          conversation_id: selectedConversation,
          role: 'assistant',
          content: 'Based on the analysis of customer support conversations, I can provide insights on customer satisfaction with recent product updates.\n\n**Overall Satisfaction:** The sentiment analysis shows a **75% positive** response to recent updates, with customers particularly appreciating the improved user interface and faster performance.\n\n**Key Findings:**\n- 68% of customers mentioned improved usability\n- 45% noted faster loading times\n- 23% reported issues with the new notification system\n\n**Common Positive Feedback:**\n- "The new interface is much cleaner"\n- "Loading is noticeably faster"\n- "Love the new dashboard layout"\n\n**Areas for Improvement:**\n- Notification frequency concerns\n- Some confusion about new feature locations\n- Request for better onboarding materials',
          timestamp: '2024-01-20T10:31:15Z',
          status: 'complete',
          citations: [
            {
              id: 'cite_001',
              room_name: 'Customer Support WhatsApp',
              time_span: 'Jan 15-20, 2024',
              snippet: 'Customer: "The new interface is much cleaner and easier to navigate. Really appreciate the updates!"',
              chunk_id: 'chunk_001',
            },
            {
              id: 'cite_002',
              room_name: 'Customer Support WhatsApp',
              time_span: 'Jan 18-20, 2024',
              snippet: 'Customer: "Loading is noticeably faster now, but I\'m getting too many notifications."',
              chunk_id: 'chunk_002',
            },
          ],
        },
      ];
      
      setMessages(mockMessages);
    }
  }, [selectedConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.preview && conv.preview.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const createNewConversation = async () => {
    const title = `New Conversation ${conversations.length + 1}`;
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      title,
      client_id: clientId,
      last_activity: 'now',
      message_count: 0,
      created_at: new Date().toISOString(),
    };
    
    setConversations(prev => [newConv, ...prev]);
    setSelectedConversation(newConv.id);
    setMessages([]);
    setIsMobileConversationView(true);
    toast.success('New conversation created');
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isStreaming) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      conversation_id: selectedConversation,
      role: 'user',
      content: newMessage,
      timestamp: new Date().toISOString(),
      status: 'complete',
    };

    const assistantMessage: Message = {
      id: `msg_${Date.now() + 1}`,
      conversation_id: selectedConversation,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      status: 'streaming',
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setNewMessage('');
    setIsStreaming(true);

    // Simulate streaming response
    try {
      const response = await simulateStreamingResponse();
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: response.content, citations: response.citations, evaluation: response.evaluation, status: 'complete' }
          : msg
      ));
      
      // Update conversation last activity
      setConversations(prev => prev.map(conv =>
        conv.id === selectedConversation
          ? { ...conv, last_activity: 'now', message_count: conv.message_count + 2 }
          : conv
      ));
      
    } catch (error: any) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: 'Sorry, I encountered an error processing your request.', status: 'error' }
          : msg
      ));
      toast.error('Failed to send message');
    } finally {
      setIsStreaming(false);
    }
  };

  const simulateStreamingResponse = async (): Promise<{ content: string; citations: Citation[]; evaluation?: EvaluationResult }> => {
    const baseResponse = {
      content: 'I\'ve analyzed the chat data based on your query. Here are the key insights:\n\n**Summary:** The analysis reveals several important patterns in the conversation data.\n\n**Key Findings:**\n- High engagement levels during peak hours\n- Common themes around product feedback\n- Strong customer sentiment indicators\n\n**Recommendations:**\n- Focus on addressing frequently mentioned concerns\n- Leverage positive feedback for marketing\n- Implement suggested improvements',
      citations: [
        {
          id: 'cite_003',
          room_name: 'Customer Support WhatsApp',
          time_span: 'Last 7 days',
          snippet: 'Customer feedback shows consistent patterns of satisfaction with response times.',
          chunk_id: 'chunk_003',
        },
      ],
    };

    // If evaluation mode is enabled, add evaluation results
    if (filters.evaluation_mode && filters.subject_user) {
      const mockEvaluation: EvaluationResult = {
        summary: {
          weighted_total: 3.8,
          confidence: 85,
        },
        drivers: [
          {
            name: 'Communication Clarity',
            weight: 0.3,
            score: 4.2,
            rationale: 'The subject demonstrates excellent communication clarity, using clear language and providing detailed explanations. Messages are well-structured and easy to understand.',
            citations: [
              {
                id: 'eval_cite_001',
                room_name: 'Customer Support WhatsApp',
                time_span: 'Jan 15-20, 2024',
                snippet: 'User provided clear step-by-step instructions: "First, navigate to Settings, then click on Account, and finally select Privacy options."',
                chunk_id: 'eval_chunk_001',
              },
              {
                id: 'eval_cite_002',
                room_name: 'Customer Support WhatsApp',
                time_span: 'Jan 18-20, 2024',
                snippet: 'User explained the issue comprehensively: "The problem occurs when I try to upload files larger than 10MB. The progress bar stops at 50% and shows an error."',
                chunk_id: 'eval_chunk_002',
              },
            ],
          },
          {
            name: 'Response Timeliness',
            weight: 0.25,
            score: 3.5,
            rationale: 'Response times are generally good but could be improved during peak hours. Average response time is within acceptable limits.',
            citations: [
              {
                id: 'eval_cite_003',
                room_name: 'Customer Support WhatsApp',
                time_span: 'Jan 15-20, 2024',
                snippet: 'Customer: "Thanks for the quick response! That solved my issue." (Response time: 3 minutes)',
                chunk_id: 'eval_chunk_003',
              },
            ],
          },
          {
            name: 'Problem Resolution',
            weight: 0.25,
            score: 4.0,
            rationale: 'Strong problem-solving approach with systematic troubleshooting. Most issues are resolved on first contact.',
            citations: [
              {
                id: 'eval_cite_004',
                room_name: 'Customer Support WhatsApp',
                time_span: 'Jan 16-20, 2024',
                snippet: 'User successfully diagnosed and resolved the connectivity issue by walking through network troubleshooting steps.',
                chunk_id: 'eval_chunk_004',
              },
            ],
          },
          {
            name: 'Customer Satisfaction',
            weight: 0.2,
            score: 3.2,
            rationale: 'Customer feedback is mostly positive, though there are some areas for improvement in handling complex technical issues.',
            citations: [
              {
                id: 'eval_cite_005',
                room_name: 'Customer Support WhatsApp',
                time_span: 'Jan 17-20, 2024',
                snippet: 'Customer: "Great service overall, though it took a while to resolve the billing issue."',
                chunk_id: 'eval_chunk_005',
              },
            ],

          },
        ],
        recommendations: [
          'Implement automated response templates for common queries to improve response times',
          'Provide additional training on complex technical issue resolution',
          'Set up proactive follow-up system for customer satisfaction tracking',
          'Consider implementing escalation procedures for complex cases',
        ],
        subject_user: filters.subject_user || 'Unknown User',
        evaluation_timestamp: new Date().toISOString(),
      };

      return { ...baseResponse, evaluation: mockEvaluation };
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return baseResponse;
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <DashboardLayout 
      title="Conversations"
      description="Analyze chat data with AI-powered insights and evaluations"
      allowedRoles={['super_admin', 'backend', 'admin', 'manager']}
    >
      <div className="h-[calc(100vh-200px)] flex bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Left Panel - Conversations List */}
        <div className={cn(
          "w-full lg:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col",
          isMobileConversationView && "hidden lg:flex"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conversations
              </h3>
              <Button size="sm" onClick={createNewConversation}>
                <PlusIcon className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <ConversationSkeleton key={i} />
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              <div className="p-2">
                {filteredConversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversation === conversation.id}
                    onClick={() => {
                      setSelectedConversation(conversation.id);
                      setIsMobileConversationView(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Chat Interface */}
        <div className={cn(
          "flex-1 flex flex-col",
          !isMobileConversationView && !selectedConversation && "hidden lg:flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setIsMobileConversationView(false)}
                      className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                    >
                      <ChevronLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {conversations.find(c => c.id === selectedConversation)?.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {messages.filter(m => m.role === 'user').length} questions asked
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <AdjustmentsHorizontalIcon className="h-4 w-4 mr-1" />
                      Filters
                    </Button>
                  </div>
                </div>
                
                {/* Filters Panel */}
                {showFilters && (
                  <FilterPanel filters={filters} setFilters={setFilters} />
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-end space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={filters.evaluation_mode ? "Ask a question for evaluation..." : "Ask a question about your chat data..."}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] resize-none"
                      rows={2}
                      disabled={isStreaming}
                    />
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>Press Enter to send, Shift+Enter for new line</span>
                      <span>{newMessage.length}/1000</span>
                    </div>
                  </div>
                  
                  {isStreaming ? (
                    <Button variant="outline" onClick={stopStreaming}>
                      <StopIcon className="h-4 w-4 mr-1" />
                      Stop
                    </Button>
                  ) : (
                    <Button 
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || newMessage.length > 1000}
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                      Send
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyChatState onCreateConversation={createNewConversation} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-xl text-left transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800",
        isSelected && "bg-[#ffe600]/10 border border-[#ffe600]/20"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
          {conversation.title}
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
          {conversation.last_activity}
        </span>
      </div>
      {conversation.preview && (
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
          {conversation.preview}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{conversation.message_count} messages</span>
        <span>{new Date(conversation.created_at).toLocaleDateString()}</span>
      </div>
    </button>
  );
}

function ConversationSkeleton() {
  return (
    <div className="p-3 rounded-xl animate-pulse">
      <div className="flex items-start justify-between mb-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
      <div className="flex justify-between">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3",
        isUser 
          ? "bg-[#ffe600] text-black" 
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
      )}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
          {message.status === 'streaming' && (
            <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1" />
          )}
        </div>
        
        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Sources:
            </p>
            <div className="space-y-2">
              {message.citations.map((citation) => (
                <CitationChip key={citation.id} citation={citation} />
              ))}
            </div>
          </div>
        )}
        
        {/* Evaluation Results */}
        {message.evaluation && (
          <div className="mt-4">
            <EvaluationScorecard evaluation={message.evaluation} />
          </div>
        )}
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {message.status === 'error' && (
            <span className="text-red-500 dark:text-red-400">Failed to send</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface CitationChipProps {
  citation: Citation;
}

function CitationChip({ citation }: CitationChipProps) {
  const [showPreview, setShowPreview] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors duration-200"
      >
        <DocumentTextIcon className="h-3 w-3 mr-1" />
        {citation.room_name} • {citation.time_span}
      </button>
      
      {showPreview && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-w-sm">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {citation.snippet}
          </p>
        </div>
      )}
    </div>
  );
}

interface FilterPanelProps {
  filters: ChatFilters;
  setFilters: (filters: ChatFilters) => void;
}

function FilterPanel({ filters, setFilters }: FilterPanelProps) {
  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Chat Type
          </label>
          <select
            value={filters.types[0]}
            onChange={(e) => setFilters({ ...filters, types: [e.target.value as any] })}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
          >
            <option value="both">Both Internal & External</option>
            <option value="internal">Internal Only</option>
            <option value="external">External Only</option>
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date From
          </label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Date To
          </label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
          />
        </div>
      </div>

      {/* Evaluation Mode */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="h-5 w-5 text-[#ffe600]" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Evaluation Mode
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enable driver-based scoring and evidence analysis
            </p>
          </div>
        </div>
        <button
          onClick={() => setFilters({ ...filters, evaluation_mode: !filters.evaluation_mode })}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
            filters.evaluation_mode ? "bg-[#ffe600]" : "bg-gray-200 dark:bg-gray-700"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
              filters.evaluation_mode ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Subject User (when evaluation mode is enabled) */}
      {filters.evaluation_mode && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Subject User (Required for evaluation)
          </label>
          <input
            type="text"
            value={filters.subject_user}
            onChange={(e) => setFilters({ ...filters, subject_user: e.target.value })}
            placeholder="Enter user name or ID to evaluate"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600]"
          />
        </div>
      )}
    </div>
  );
}

function EmptyChatState({ onCreateConversation }: { onCreateConversation: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ChatBubbleLeftRightIcon className="h-8 w-8 text-[#ffe600]" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Start Your First Conversation
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Ask questions about your chat data and get AI-powered insights with citations and evidence.
        </p>
        <Button onClick={onCreateConversation}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create New Conversation
        </Button>
      </div>
    </div>
  );
}
