'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ClientPicker } from '@/components/ui/ClientPicker';
import { Button } from '@/components/ui/Button';
import { EvaluationScorecard } from '@/components/chat/EvaluationScorecard';
import { cn } from '@/lib/utils';
import toast, { Toaster } from 'react-hot-toast';
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
  ArrowPathIcon,
  Bars3Icon,
  XMarkIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { QueryRequest, RoomType } from '@/types/api';
// REMOVED: ReactMarkdown imports - replaced with custom progressive formatting
import { createClient } from '@supabase/supabase-js';

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
  result_json?: any;
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

interface Client {
  id: string;
  name: string;
  is_active: boolean;
}

// Helper function to format last activity
function formatLastActivity(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) {
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours === 0) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
    }
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  } else if (diffInDays === 1) {
    return '1 day ago';
  } else if (diffInDays < 30) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export default function ChatConversationsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { platformUser, supabase, lazyAuthenticate } = useAuth();
  const clientId = params.clientId as string;
  
  // REMOVED: Duplicate function - moved to global scope for MessageBubble access
  
  // REMOVED: Old CSS injection - no longer needed with new approach
  
  const [client, setClient] = useState<Client | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobileConversationView, setIsMobileConversationView] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false);
  
  // REMOVED: Old markdown refresh mechanism - replaced with stable content-based keys
  
  // IMMEDIATE URL parameter processing - runs before fetchData
  useEffect(() => {
    const conversationIdFromUrl = searchParams.get('conversation');
    if (conversationIdFromUrl && !hasInitializedFromUrl) {
      // Validate that the conversation exists in our list
      if (conversations.length > 0) {
        const foundConversation = conversations.find(c => c.id === conversationIdFromUrl);
        if (foundConversation) {
          setSelectedConversation(conversationIdFromUrl);
          setHasInitializedFromUrl(true);
        }
      } else {
        // Conversations not loaded yet, set the ID and validate later
        setSelectedConversation(conversationIdFromUrl);
        setHasInitializedFromUrl(true);
      }
    }
  }, [searchParams, hasInitializedFromUrl, conversations]);
  
  const [filters, setFilters] = useState<ChatFilters>({
    types: ['both'],
    room_ids: [],
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    date_to: new Date().toISOString(),
    participants: [],
    evaluation_mode: false,
    subject_user: '',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // REMOVED: Complex content hash logic - not needed for simple approach

  // REMOVED: Old markdown refresh cleanup - no longer needed

  // Fetch real data from database
  useEffect(() => {
    // FIXED: Prevent multiple simultaneous fetches
    let isMounted = true;
    let isFetching = false;
    
    const fetchData = async () => {
      // Prevent multiple simultaneous fetches
      if (isFetching) return;
      isFetching = true;
      
      if (!isMounted) return;
      
      setLoading(true);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No authenticated session');
        }

        if (!isMounted) return;

        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id, name, is_active')
          .eq('id', clientId)
          .single();

        if (clientError) throw clientError;
        if (!clientData) {
          if (isMounted) {
            setClient(null);
            setLoading(false);
          }
          return;
        }

        if (!isMounted) return;

        setClient({
          id: clientData.id,
          name: clientData.name,
          is_active: clientData.is_active,
        });

        const { data: conversationsData, error: conversationsError } = await supabase
          .from('conversations')
          .select(`
            id,
            title,
            client_id,
            created_at,
            updated_at,
            queries (
              id,
              query_text
            )
          `)
          .eq('client_id', clientId)
          .order('updated_at', { ascending: false });

        if (conversationsError) throw conversationsError;

        if (!isMounted) return;

        const transformedConversations: Conversation[] = (conversationsData || []).map((conv: any) => {
          const messageCount = (conv.queries?.length || 0) * 2;
          const firstQuery = conv.queries?.[0]?.query_text;
          
          return {
            id: conv.id,
            title: conv.title || 'Untitled Conversation',
            client_id: conv.client_id,
            last_activity: formatLastActivity(conv.updated_at),
            message_count: messageCount,
            created_at: conv.created_at,
            preview: firstQuery ? firstQuery.substring(0, 100) + (firstQuery.length > 100 ? '...' : '') : undefined,
          };
        });

        setConversations(transformedConversations);
        
        // Validate URL parameter conversation if it was set before conversations loaded
        if (transformedConversations.length > 0 && selectedConversation && hasInitializedFromUrl) {
          const foundConversation = transformedConversations.find(c => c.id === selectedConversation);
          if (!foundConversation) {
            // URL parameter conversation doesn't exist, reset to first conversation
            setSelectedConversation(transformedConversations[0].id);
          }
        }
        
        // Auto-select conversation: only if no conversation is already selected
        if (transformedConversations.length > 0 && !selectedConversation && !hasInitializedFromUrl) {
          // No conversation selected and not initialized from URL, select first conversation
          setSelectedConversation(transformedConversations[0].id);
          setHasInitializedFromUrl(true);
        }
        
      } catch (error: any) {
        console.error('Error fetching conversations:', error);
        
        if (!isMounted) return;
        
        if (error.code === '42703') {
          toast.error('Database schema error - please contact support');
        } else if (error.message === 'No authenticated session') {
          router.push('/auth/login');
          return;
        } else {
          toast.error('Failed to load conversations');
        }
        
        setClient(null);
        setConversations([]);
      } finally {
        if (isMounted) {
          setLoading(false);
          isFetching = false;
        }
      }
    };

    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [clientId, supabase, router]); // FIXED: Removed searchParams to prevent infinite loops

  // Load messages for selected conversation from database
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversation) {
        setMessages([]);
        return;
      }

      // FIXED: Reset streaming state when switching conversations
      setIsStreaming(false);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No authenticated session');
        }


        const { data: queriesData, error: queriesError } = await supabase
          .from('queries')
          .select(`
            id,
            query_text,
            response_text,
            question,
            answer,
            created_at,
            context_chunks,
            citations_json,
            evaluation_json,
            evaluation_enabled
          `)
          .eq('conversation_id', selectedConversation)
          .order('created_at', { ascending: true });
        
        if (queriesError) throw queriesError;

        const transformedMessages: Message[] = [];
        
        (queriesData || []).forEach((query: any) => {
          const questionText = query.question || query.query_text;
          const answerText = query.answer || query.response_text;
          const citations = query.citations_json || query.context_chunks || [];
          
          if (questionText) {
            transformedMessages.push({
              id: `user_${query.id}`,
              conversation_id: selectedConversation!,
              role: 'user',
              content: questionText,
              timestamp: query.created_at,
              status: 'complete',
            });

            if (answerText) {
              transformedMessages.push({
                id: `assistant_${query.id}`,
                conversation_id: selectedConversation!,
                role: 'assistant',
                content: answerText,
                timestamp: query.created_at,
                status: 'complete',
                citations: citations,
                evaluation: query.evaluation_json || (query.evaluation_enabled ? {} : undefined),
              });
            }
          }
        });


        setMessages(transformedMessages);
        
      } catch (error: any) {
        console.error('Error loading messages:', error);
        toast.error('Failed to load conversation messages');
        setMessages([]);
      }
    };

    loadMessages();
  }, [selectedConversation, supabase]);

  // SIMPLE SCROLL APPROACH: Only scroll for new messages, preserve user position
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);
  
  useEffect(() => {
    // Only auto-scroll when NEW messages are added
    if (messages.length > lastMessageCount) {
      setLastMessageCount(messages.length);
      setUserHasScrolledUp(false); // Reset when new message arrives
      // Force scroll to bottom for new messages
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length, lastMessageCount]);
  
  // Simple scroll detection
  useEffect(() => {
    const messagesContainer = document.querySelector('.flex-1.overflow-y-auto');
    if (!messagesContainer) return;
    
    const handleScroll = () => {
      const scrollTop = messagesContainer.scrollTop;
      const scrollHeight = messagesContainer.scrollHeight;
      const clientHeight = messagesContainer.clientHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      // If user is more than 200px from bottom, they've scrolled up
      if (distanceFromBottom > 200) {
        setUserHasScrolledUp(true);
      } else {
        setUserHasScrolledUp(false);
      }
    };
    
    messagesContainer.addEventListener('scroll', handleScroll);
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // FIXED: Proper tab switching handling that doesn't interfere with chat functionality
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only handle conversation selection, don't interfere with chat state
      if (!document.hidden && conversations.length > 0 && !selectedConversation && !hasInitializedFromUrl) {
        setSelectedConversation(conversations[0].id);
        setHasInitializedFromUrl(true);
      }
      
      // FIXED: Reset stuck streaming state when tab becomes visible
      if (!document.hidden && isStreaming) {
        console.log('🔄 Tab became visible, checking for stuck streaming state...');
        // Give a small delay to see if streaming is actually working
        setTimeout(() => {
          if (isStreaming) {
            console.log('🔄 Detected stuck streaming state, resetting...');
            setIsStreaming(false);
            // Reset any streaming messages to error state
            setMessages(prev => prev.map(msg => 
              msg.status === 'streaming' 
                ? { ...msg, status: 'error', content: 'Connection was interrupted. Please try again.' }
                : msg
            ));
          }
        }, 2000); // Wait 2 seconds to see if streaming recovers
      }
    };

    const handleFocus = () => {
      // Only handle conversation selection, don't interfere with chat state
      if (conversations.length > 0 && !selectedConversation && !hasInitializedFromUrl) {
        setSelectedConversation(conversations[0].id);
        setHasInitializedFromUrl(true);
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [conversations, selectedConversation, hasInitializedFromUrl, isStreaming]);


  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.preview && conv.preview.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const createNewConversation = async () => {
    setIsCreatingConversation(true);
    try {
      toast.loading('Creating new conversation...', { id: 'create-conversation' });
      
      const { api } = await import('@/lib/api-services');
      
      const title = `New Conversation ${conversations.length + 1}`;
      
      const response = await api.conversations.create(supabase, {
        client_id: parseInt(clientId),
        title,
      });
      
      const newConv: Conversation = {
        id: response.conversation_id.toString(),
        title,
        client_id: clientId,
        last_activity: 'Just now',
        message_count: 0,
        created_at: new Date().toISOString(),
      };
      
      setConversations(prev => [newConv, ...prev]);
      setSelectedConversation(newConv.id);
      setMessages([]);
      setIsMobileConversationView(true);
      
      toast.success('New conversation created!', { id: 'create-conversation' });
      
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      
      toast.error('Failed to create conversation', { id: 'create-conversation' });
      
      if (error.error_code === 'E_UNAUTHORIZED') {
        toast.error('Please sign in again');
      } else if (error.error_code === 'E_FORBIDDEN_CLIENT') {
        toast.error('You don\'t have access to this client');
      } else if (error.message) {
        toast.error(`Failed to create conversation: ${error.message}`);
      } else {
        toast.error('Failed to create conversation');
      }
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isStreaming) {
      console.log('🚫 sendMessage early return:', { 
        noMessage: !newMessage.trim(), 
        noConversation: !selectedConversation, 
        isStreaming 
      });
      return;
    }

    // IMMEDIATE USER FEEDBACK - No blocking session validation
    // User sees "ATOM is thinking..." instantly while auth happens in background

    // REMOVED: Proactive session validation that was blocking the UI
    // Session validation will happen automatically in the API call via the SSE stream
    // This provides immediate user feedback ("ATOM is thinking...") while auth happens in background
    console.log('🚀 Proceeding with message - session validation will happen in API call');

    // Create user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      conversation_id: selectedConversation,
      role: 'user',
      content: newMessage,
      timestamp: new Date().toISOString(),
      status: 'complete',
    };

    // Create assistant message placeholder with "ATOM is thinking..."
    const assistantMessage: Message = {
      id: `msg_${Date.now() + 1}`,
      conversation_id: selectedConversation,
      role: 'assistant',
      content: 'ATOM is thinking...',
      timestamp: new Date().toISOString(),
      status: 'streaming',
    };

    // Add messages to state
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    const currentMessage = newMessage;
            setNewMessage(''); // FIXED: Clear input after sending
        setIsStreaming(true);

    // FIXED: Add timeout to prevent stuck streaming
    let streamingTimeout: NodeJS.Timeout | undefined;
    
    try {
      // FIXED: Ensure we're not in a stuck state
      let streamingContent = '';
      
      // FIXED: Add timeout to prevent stuck streaming
      streamingTimeout = setTimeout(() => {
        if (isStreaming) {
          console.log('⏰ Streaming timeout reached, resetting stuck state...');
          setIsStreaming(false);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, status: 'error', content: 'Request timed out. Please try again.' }
              : msg
          ));
        }
      }, 30000); // 30 second timeout
      
      const { api } = await import('@/lib/api-services');

      const queryRequest: QueryRequest = {
        client_id: parseInt(clientId),
        conversation_id: parseInt(selectedConversation!),
        question: currentMessage,
        filters: {
          types: filters.types.includes('both') ? ['internal', 'external'] as RoomType[] : filters.types as RoomType[],
          room_ids: filters.room_ids.length > 0 ? filters.room_ids.map(id => parseInt(id)) : undefined,
          date_from: filters.date_from,
          date_to: filters.date_to,
          participants: filters.participants.length > 0 ? filters.participants : undefined,
        },
        evaluation_mode: filters.evaluation_mode,
        subject_user: filters.evaluation_mode ? filters.subject_user : undefined,
      };

      let citations: Citation[] = [];
      let evaluation: EvaluationResult | undefined;

      const { abort } = await api.conversations.query(supabase, queryRequest, {
        onMeta: (meta: any) => {
          // Meta event received
        },
        onToken: (token: string) => {
          // Clear timeout on first token
          if (streamingTimeout) clearTimeout(streamingTimeout);
          
          // FIXED: Add space after each token to compensate for SSE whitespace stripping
          const tokenWithSpace = token + ' ';
          streamingContent += tokenWithSpace;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: streamingContent, status: 'streaming', citations: msg.citations, evaluation: msg.evaluation }
              : msg
          ));
          
          // FIXED: Don't refresh during streaming to allow text selection
        },
        onCitations: (citationData: any[]) => {
          citations = citationData;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, citations, status: 'streaming' as const }
              : msg
          ));
        },
        onEvaluationPayload: (evaluationData: any) => {
          evaluation = evaluationData;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, evaluation }
              : msg
          ));
        },
        onDone: (doneData: any) => {
          if (streamingTimeout) clearTimeout(streamingTimeout);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, status: 'complete', citations: msg.citations, evaluation: msg.evaluation }
              : msg
          ));
          
          setConversations(prev => prev.map(conv =>
            conv.id === selectedConversation
              ? { ...conv, last_activity: 'Just now', message_count: conv.message_count + 2 }
              : conv
          ));
          
          setIsStreaming(false);
          
          // FIXED: Markdown will refresh automatically when content changes
        },
        onError: (error: any) => {
          if (streamingTimeout) clearTimeout(streamingTimeout);
          console.error('❌ Streaming error:', error);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: 'Sorry, I encountered an error processing your request.', status: 'error', citations: msg.citations, evaluation: msg.evaluation }
              : msg
          ));
          toast.error('Failed to process query');
          setIsStreaming(false);
        },
      });

      eventSourceRef.current = { close: abort } as EventSource;
      
    } catch (error: any) {
      if (streamingTimeout) clearTimeout(streamingTimeout);
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: 'Sorry, I encountered an error processing your request.', status: 'error' }
          : msg
      ));
      toast.error('Failed to send message');
      setIsStreaming(false);
    }
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

  const handleClientChange = (newClientId: string) => {
    setHasInitializedFromUrl(false); // Reset initialization flag for new client
    router.push(`/chat/${newClientId}/conversations`);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Mobile Menu + Brand */}
          <div className="flex items-center space-x-3 lg:space-x-8">
            {/* Mobile Menu Toggle - Left Side */}
            <button
              onClick={() => setIsMobileConversationView(!isMobileConversationView)}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
              title="Toggle menu"
            >
              <Bars3Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-7 h-7 lg:w-8 lg:h-8 bg-gradient-to-br from-[#ffe600] to-[#ffd700] rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-xs lg:text-sm">T</span>
              </div>
              <span className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">TingAI</span>
            </div>
            
            <div className="hidden md:block w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
            <div className="hidden md:flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Client:</span>
              <div className="w-64">
                <ClientPicker
                  selectedClientId={clientId}
                  onClientSelect={handleClientChange}
                  placeholder="Select a client..."
                />
              </div>
            </div>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center space-x-2 lg:space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/clients/${clientId}/rooms`)}
              className="hidden md:flex"
            >
              <DocumentTextIcon className="h-4 w-4 mr-1" />
              Manage Rooms
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="hidden md:flex"
            >
              <Cog6ToothIcon className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            
            {/* Theme Toggle */}
            <button
              onClick={() => document.documentElement.classList.toggle('dark')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
              title="Toggle theme"
            >
              <SunIcon className="h-4 w-4 lg:h-5 lg:w-5 text-gray-600 dark:text-gray-400 hidden dark:block" />
              <MoonIcon className="h-4 w-4 lg:h-5 lg:w-5 text-gray-600 dark:text-gray-400 block dark:hidden" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileConversationView && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileConversationView(false)}
        />
      )}

      {/* Left Panel - Conversations List */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-80 lg:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-800 mt-20 lg:mt-20 transform transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none",
        isMobileConversationView ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conversations
              </h3>
              {/* Mobile Close Button */}
              <button
                onClick={() => setIsMobileConversationView(false)}
                className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                title="Close sidebar"
              >
                <XMarkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <Button
              size="sm"
              onClick={createNewConversation}
              disabled={isCreatingConversation}
              className="min-w-[80px]"
            >
              {isCreatingConversation ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  New
                </>
              )}
            </Button>
          </div>
          
          {/* Mobile Client Selector and Navigation */}
          <div className="md:hidden space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {/* Client Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Client
              </label>
              <div className="w-full">
                <ClientPicker
                  selectedClientId={clientId}
                  onClientSelect={handleClientChange}
                  placeholder="Select a client..."
                />
              </div>
            </div>
            
            {/* Mobile Navigation Links */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  router.push(`/clients/${clientId}/rooms`);
                  setIsMobileConversationView(false);
                }}
                className="flex-1"
              >
                <DocumentTextIcon className="h-4 w-4 mr-1" />
                Manage Rooms
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  router.push('/dashboard');
                  setIsMobileConversationView(false);
                }}
                className="flex-1"
              >
                <Cog6ToothIcon className="h-4 w-4 mr-1" />
                Dashboard
              </Button>
            </div>
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
          ) : isCreatingConversation ? (
            <div className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-[#ffe600] border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Creating new conversation...
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              {!searchQuery && (
                <p className="text-gray-400 dark:text-gray-500 text-xs">
                  Start by creating your first conversation to analyze chat data
                </p>
              )}
            </div>
          ) : (
            <div className="p-2">
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedConversation === conversation.id}
                  onClick={() => {
                    console.log('🔄 Conversation switching:', {
                      from: selectedConversation,
                      to: conversation.id,
                      conversationTitle: conversation.title
                    });
                    setSelectedConversation(conversation.id);
                    setIsMobileConversationView(true);
                    router.push(`/chat/${clientId}/conversations?conversation=${conversation.id}`, { scroll: false });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat Interface */}
      <div className={cn(
        "flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-0 mt-20 lg:mt-20",
        !isMobileConversationView && !selectedConversation && "hidden lg:flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <button
                    onClick={() => setIsMobileConversationView(false)}
                    className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 flex-shrink-0"
                    title="Back to conversations"
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white truncate">
                      {conversations.find(c => c.id === selectedConversation)?.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {messages.filter(m => m.role === 'user').length} questions asked
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="hidden sm:flex"
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4 mr-1" />
                    Filters
                  </Button>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                    title="Toggle filters"
                  >
                    <FunnelIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
              
              {/* Filters Panel */}
              {showFilters && (
                <FilterPanel filters={filters} setFilters={setFilters} />
              )}
            </div>

            {/* Messages */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0 relative">
                {messages.map((message) => (
                                   <MessageBubble 
                   key={message.id} 
                   message={message}
                 />
                ))}
                <div ref={messagesEndRef} />
                
                {/* Scroll to bottom button - only show when user has scrolled up */}
                {userHasScrolledUp && (
                  <button
                    onClick={() => {
                      setUserHasScrolledUp(false);
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="fixed bottom-24 right-6 z-10 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                    title="Scroll to bottom"
                  >
                    <ArrowDownIcon className="h-5 w-5" />
                  </button>
                )}
              </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex items-end space-x-3">
                <div className="flex-1 min-w-0">
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
                    <div className="flex items-center space-x-2">
                      <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
                      <span className="sm:hidden">Enter to send</span>
                      {/* FIXED: Manual markdown refresh button for proper formatting */}
                      
                    </div>
                    <span>{newMessage.length}/1000</span>
                  </div>
                </div>
                
                {isStreaming ? (
                  <Button variant="outline" onClick={stopStreaming} className="flex-shrink-0">
                    <StopIcon className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Stop</span>
                  </Button>
                ) : (
                                                                              <Button 
                        onClick={() => {
                          sendMessage();
                        }}
                        disabled={!newMessage.trim() || newMessage.length > 1000}
                      className="flex-shrink-0"
                    >
                    <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptyChatState onCreateConversation={createNewConversation} />
        )}
      </div>
      
      {/* Toast Container */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 9999,
          },
          success: {
            style: {
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
            },
          },
          error: {
            style: {
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
            },
          },
        }}
      />
    </div>
  );
}

// PROPER REACT MARKDOWN RENDERER: Preserves text selection during and after streaming
const MarkdownRenderer: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming = false }) => {
  // CRITICAL: Render inline formatting as React elements for text selection
  const renderInlineFormatting = (text: string) => {
    if (!text) return null;
    
    // Split text by markdown patterns and render each part as React elements
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    
    return parts.map((part, partIndex) => {
      // Bold text (**text**)
      const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
      if (boldMatch) {
        return <strong key={partIndex} className="font-semibold text-gray-900 dark:text-white">{boldMatch[1]}</strong>;
      }
      
      // Italic text (*text*)
      const italicMatch = part.match(/^\*(.*?)\*$/);
      if (italicMatch) {
        return <em key={partIndex} className="italic text-gray-600 dark:text-gray-400">{italicMatch[1]}</em>;
      }
      
      // Inline code (`code`)
      const codeMatch = part.match(/^`(.*?)`$/);
      if (codeMatch) {
        return <code key={partIndex} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200">{codeMatch[1]}</code>;
      }
      
      // Regular text
      return <span key={partIndex}>{part}</span>;
    });
  };

  const renderContent = useMemo(() => {
    if (!content) return [];
    
    // Split content into lines for proper rendering
    const lines = content.split('\n');
    
    return lines.map((line, lineIndex) => {
      // Handle numbered lists (1. 2. 3.)
      const numberedListMatch = line.match(/^(\d+\.\s+)(.+)$/);
      if (numberedListMatch) {
        return (
          <div key={lineIndex} className="flex items-start mb-2">
            <span className="font-mono text-gray-500 mr-2 flex-shrink-0">{numberedListMatch[1]}</span>
            <span className="flex-1">{renderInlineFormatting(numberedListMatch[2])}</span>
          </div>
        );
      }
      
      // Handle bullet points (- or *)
      const bulletMatch = line.match(/^([-*]\s+)(.+)$/);
      if (bulletMatch) {
        return (
          <div key={lineIndex} className="flex items-start mb-2">
            <span className="text-gray-500 mr-2 flex-shrink-0">•</span>
            <span className="flex-1">{renderInlineFormatting(bulletMatch[2])}</span>
          </div>
        );
      }
      
      // Handle empty lines
      if (line.trim() === '') {
        return <div key={lineIndex} className="h-2" />;
      }
      
      // Handle regular text with inline formatting
      return (
        <div key={lineIndex} className="mb-1">
          {renderInlineFormatting(line)}
        </div>
      );
    });
  }, [content]);
  
  return (
    <div className="markdown-content">
      {renderContent}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-current opacity-75 animate-pulse ml-1" />
      )}
    </div>
  );
};

// Component definitions
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
      <div 
        data-message-id={message.id}
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser 
            ? "bg-[#ffe600] text-black" 
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
        )}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content === 'ATOM is thinking...' && message.status === 'streaming' ? (
            <div className="flex items-center space-x-2">
              <span>ATOM is thinking</span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-sm max-w-none dark:prose-invert markdown-content">
                {/* SIMPLE STABLE APPROACH: No DOM manipulation, just stable content */}
                                                  <div 
                   key={message.id}
                   className="whitespace-pre-wrap break-words"
                 >
                   <MarkdownRenderer content={message.content} isStreaming={message.status === 'streaming'} />
                 </div>
                             </div>
                             
            </>
          )}
        </div>
        
        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Sources ({message.citations.length})
            </p>
            <div className="grid gap-3">
              {message.citations.map((citation, index) => (
                <CitationChip key={`${citation.id}-${index}`} citation={citation} />
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
  
  // Close preview when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPreview && !event.target) return;
      const target = event.target as Element;
      if (!target.closest('.citation-chip')) {
        setShowPreview(false);
      }
    };

    if (showPreview) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPreview]);
  
  return (
    <div className="relative citation-chip">
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 transition-all duration-200 border border-blue-200 dark:border-blue-700/50 shadow-sm hover:shadow-md"
      >
        <DocumentTextIcon className="h-4 w-4 mr-2" />
        <span className="truncate max-w-32">{citation.room_name || 'Unknown Room'}</span>
        <span className="mx-2 text-blue-500">•</span>
        <span className="text-xs opacity-80">{citation.time_span || 'Unknown Time'}</span>
      </button>
      
      {showPreview && (
        <div className="absolute top-full left-0 mt-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-20 max-w-md min-w-80 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
              <DocumentTextIcon className="h-4 w-4 mr-2 text-blue-500" />
              Source Content
            </h4>
            <button
              onClick={() => setShowPreview(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          
          {/* Content */}
          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {citation.snippet || 'No content available'}
              </p>
            </div>
            
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">Room:</span>
                <p className="truncate">{citation.room_name || 'Unknown'}</p>
              </div>
              <div>
                <span className="font-medium">Time:</span>
                <p className="truncate">{citation.time_span || 'Unknown'}</p>
              </div>
            </div>
          </div>
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