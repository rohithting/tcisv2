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
  ChevronDownIcon,
  PaperAirplaneIcon,
  StopIcon,
  CalendarIcon,
  UserGroupIcon,
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
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [showCitationModal, setShowCitationModal] = useState(false);
  // Search state
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
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
  


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch real data from database
  useEffect(() => {
    let isMounted = true;
    let isFetching = false;
    
    const fetchData = async () => {
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
  }, [clientId, supabase, router]);

  // Load messages for selected conversation from database
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversation) {
        setMessages([]);
        return;
      }

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only handle conversation selection, don't interfere with chat state
      if (!document.hidden && conversations.length > 0 && !selectedConversation && !hasInitializedFromUrl) {
        setSelectedConversation(conversations[0].id);
        setHasInitializedFromUrl(true);
      }
      
      // Reset stuck streaming state when tab becomes visible
      if (!document.hidden && isStreaming) {
        setTimeout(() => {
          if (isStreaming) {
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

  // Listen for citation modal events
  useEffect(() => {
    const handleShowCitationModal = (event: CustomEvent) => {
      setSelectedCitation(event.detail);
      setShowCitationModal(true);
    };

    window.addEventListener('showCitationModal', handleShowCitationModal as EventListener);
    
    return () => {
      window.removeEventListener('showCitationModal', handleShowCitationModal as EventListener);
    };
  }, []);

  // Prefer server-assisted search results when present; fallback to client-side filter
  const filteredConversations = (searchResults ?? conversations).filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.preview && conv.preview.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Debounced server-assisted search across conversation titles and recent queries
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        // 1) Title search on conversations (current client)
        const { data: titleMatches, error: titleErr } = await supabase
          .from('conversations')
          .select(`id, title, client_id, created_at, updated_at, queries ( id, query_text )`)
          .eq('client_id', clientId)
          .ilike('title', `%${term}%`)
          .order('updated_at', { ascending: false });
        if (titleErr) throw titleErr;

        // 2) Query text search limited to this client's loaded conversations
        const convIds = conversations.map(c => c.id);
        let queryMatchesIds: string[] = [];
        if (convIds.length > 0) {
          const { data: queryMatches, error: queryErr } = await supabase
            .from('queries')
            .select('conversation_id, query_text, question')
            .in('conversation_id', convIds)
            .or(`query_text.ilike.%${term}%,question.ilike.%${term}%`);
          if (!queryErr && queryMatches) {
            queryMatchesIds = Array.from(new Set(queryMatches.map(q => String(q.conversation_id))));
          }
        }

        // Merge IDs from both sources
        const idsFromTitle = new Set((titleMatches || []).map((c: any) => String(c.id)));
        for (const id of queryMatchesIds) idsFromTitle.add(id);

        // Produce result list from existing conversations to keep our card display consistent
        const resultList: Conversation[] = conversations
          .filter(c => idsFromTitle.has(String(c.id)))
          .sort((a, b) => (a.last_activity < b.last_activity ? 1 : -1));

        if (!cancelled) setSearchResults(resultList);
      } catch {
        if (!cancelled) setSearchResults(null);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300); // debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, clientId, supabase, conversations]);

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
      return;
    }

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
    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      conversation_id: selectedConversation,
      role: 'assistant',
      content: 'ATOM is thinking...',
      timestamp: new Date().toISOString(),
      status: 'streaming',
    };

    // Add messages to state
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    const currentMessage = newMessage;
    setNewMessage(''); // Clear input after sending
    setIsStreaming(true);

    let streamingTimeout: NodeJS.Timeout | undefined;
    
    try {
      let streamingContent = '';
      
      streamingTimeout = setTimeout(() => {
        if (isStreaming) {
          setIsStreaming(false);
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
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
          
          // FIXED: Force React to re-render with new object reference
          setMessages(prev => {
            const newMessages = [...prev];
            const messageIndex = newMessages.findIndex(msg => msg.id === assistantMessageId);
            if (messageIndex !== -1) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                content: streamingContent,
                status: 'streaming' as const,
                citations: [...citations], // New array reference
                evaluation: evaluation
              };
            }
            return newMessages;
          });
        },
        onCitations: (citationData: any[]) => {
          // Ensure citations are properly formatted
          citations = citationData.map((citation: any) => ({
            id: citation.id || `citation-${Date.now()}-${Math.random()}`,
            room_name: citation.room_name || citation.roomName || 'Unknown Room',
            time_span: citation.time_span || citation.timeSpan || 'Unknown Time',
            snippet: citation.snippet || citation.content || 'No content available',
            chunk_id: citation.chunk_id || citation.chunkId || 'unknown'
          }));
          
          // FIXED: Force React to re-render with new object reference
          setMessages(prev => {
            const newMessages = [...prev];
            const messageIndex = newMessages.findIndex(msg => msg.id === assistantMessageId);
            if (messageIndex !== -1) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                citations: [...citations], // New array reference forces re-render
                status: 'streaming' as const
              };
            }
            return newMessages;
          });
        },
        onEvaluationPayload: (evaluationData: any) => {
          evaluation = evaluationData;
          setMessages(prev => {
            const newMessages = [...prev];
            const messageIndex = newMessages.findIndex(msg => msg.id === assistantMessageId);
            if (messageIndex !== -1) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                evaluation: evaluation
              };
            }
            return newMessages;
          });
        },
        onDone: (doneData: any) => {
          if (streamingTimeout) clearTimeout(streamingTimeout);
          
          setMessages(prev => {
            const newMessages = [...prev];
            const messageIndex = newMessages.findIndex(msg => msg.id === assistantMessageId);
            if (messageIndex !== -1) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                content: streamingContent,
                status: 'complete' as const,
                citations: [...citations], // New array reference
                evaluation: evaluation
              };
            }
            return newMessages;
          });
          
          setConversations(prev => prev.map(conv =>
            conv.id === selectedConversation
              ? { ...conv, last_activity: 'Just now', message_count: conv.message_count + 2 }
              : conv
          ));
          
          setIsStreaming(false);
        },
        onError: (error: any) => {
          if (streamingTimeout) clearTimeout(streamingTimeout);
          
          setMessages(prev => {
            const newMessages = [...prev];
            const messageIndex = newMessages.findIndex(msg => msg.id === assistantMessageId);
            if (messageIndex !== -1) {
              newMessages[messageIndex] = {
                ...newMessages[messageIndex],
                content: 'Sorry, I encountered an error processing your request.',
                status: 'error' as const,
                citations: [...citations], // New array reference
                evaluation: evaluation
              };
            }
            return newMessages;
          });
          
          toast.error('Failed to process query');
          setIsStreaming(false);
        },
      });

      eventSourceRef.current = { close: abort } as EventSource;
      
    } catch (error: any) {
      if (streamingTimeout) clearTimeout(streamingTimeout);
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
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
      <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 sm:px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Mobile Menu + Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-8">
            {/* Mobile Menu Toggle - Left Side */}
            <button
              onClick={() => setIsMobileConversationView(!isMobileConversationView)}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 min-h-[44px] min-w-[44px] touch-target"
              title="Toggle menu"
            >
              <Bars3Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 bg-gradient-to-br from-[#ffe600] to-[#ffd700] rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-xs lg:text-sm">T</span>
              </div>
              <span className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white">TingAI</span>
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
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
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
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 min-h-[44px] min-w-[44px] touch-target"
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
        "fixed lg:static inset-y-0 left-0 z-40 w-80 lg:w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none",
        isMobileConversationView ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-800 pt-20 lg:pt-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-between mb-4 pt-2">
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                Conversations
              </h3>
              {/* Mobile Close Button */}
              <button
                onClick={() => setIsMobileConversationView(false)}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 min-h-[44px] min-w-[44px] touch-target"
                title="Close sidebar"
              >
                <XMarkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <Button
              size="sm"
              onClick={createNewConversation}
              disabled={isCreatingConversation}
              className="min-w-[90px] h-10 px-4 font-medium shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isCreatingConversation ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New
                </>
              )}
            </Button>
          </div>
          
          {/* Mobile Client Selector and Navigation */}
          <div className="md:hidden space-y-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            {/* Collapsible Client Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Client
                </label>
                <button
                  onClick={() => setShowClientDetails(!showClientDetails)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                  title="Toggle client details"
                >
                  <ChevronDownIcon className={cn(
                    "h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200",
                    showClientDetails ? "rotate-180" : ""
                  )} />
                </button>
              </div>
              
              {showClientDetails && (
                <div className="space-y-4 pl-2">
                  <div className="w-full">
                    <ClientPicker
                      selectedClientId={clientId}
                      onClientSelect={handleClientChange}
                      placeholder="Select a client..."
                    />
                  </div>
                  
                  {/* Mobile Navigation Links */}
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push(`/clients/${clientId}/rooms`);
                        setIsMobileConversationView(false);
                      }}
                      className="flex-1 min-h-[44px] touch-target h-10"
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-2" />
                      Manage Rooms
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        router.push('/dashboard');
                        setIsMobileConversationView(false);
                      }}
                      className="flex-1 min-h-[44px] touch-target h-10"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Search */}
          <div className="relative pt-3">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] min-h-[48px] touch-target shadow-sm hover:shadow-md transition-all duration-200"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <div className="h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-6 py-8 space-y-4">
              {[...Array(4)].map((_, i) => (
                <ConversationSkeleton key={i} />
              ))}
            </div>
          ) : isCreatingConversation ? (
            <div className="px-6 py-12 text-center">
              <div className="animate-spin h-10 w-10 border-3 border-[#ffe600] border-t-transparent rounded-full mx-auto mb-6"></div>
              <p className="text-gray-600 dark:text-gray-300 text-base font-medium">
                Creating new conversation...
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 mx-auto mb-6" />
              <p className="text-gray-600 dark:text-gray-300 text-base font-medium mb-3">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              {!searchQuery && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Start by creating your first conversation to analyze chat data
                </p>
              )}
            </div>
          ) : (
            <div className="px-4 py-6 space-y-2">
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedConversation === conversation.id}
                  onClick={() => {
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
        "flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-0",
        !isMobileConversationView && !selectedConversation && "hidden lg:flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pt-20 lg:pt-24">
              {/* Mobile: full width, Desktop: centered ChatGPT-style */}
              <div className="w-full px-4 sm:px-5 md:px-6 lg:max-w-4xl lg:mx-auto lg:px-8 xl:max-w-5xl xl:px-12 2xl:max-w-6xl 2xl:px-16 py-3 sm:py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <button
                      onClick={() => setIsMobileConversationView(false)}
                      className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 flex-shrink-0 min-h-[44px] min-w-[44px] touch-target"
                      title="Back to conversations"
                    >
                      <ChevronLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white truncate">
                        {conversations.find(c => c.id === selectedConversation)?.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {messages.filter(m => m.role === 'user').length} questions asked
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 flex-shrink-0">
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto min-h-0 relative">
              {/* Mobile: full width, Desktop: centered ChatGPT-style */}
              <div className="w-full px-4 sm:px-5 md:px-6 lg:max-w-4xl lg:mx-auto lg:px-8 xl:max-w-5xl xl:px-12 2xl:max-w-6xl 2xl:px-16 overflow-x-hidden [word-break:break-word]">
                <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
                  {messages.map((message) => (
                    <MessageBubble 
                      key={message.id} 
                      message={message}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                
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
            </div>

            {/* Message Input */}
            <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              {/* Mobile: full width, Desktop: centered ChatGPT-style */}
              <div className="w-full px-4 sm:px-5 md:px-6 lg:max-w-4xl lg:mx-auto lg:px-8 xl:max-w-5xl xl:px-12 2xl:max-w-6xl 2xl:px-16 py-3 sm:py-4">
                <div className="flex items-end space-x-2 sm:space-x-3 w-full">
                  <div className="flex-1 min-w-0 max-w-full">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask a question about your chat data..."
                      className="w-full max-w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ffe600]/20 focus:border-[#ffe600] resize-none text-sm sm:text-base min-h-[44px] touch-target"
                      rows={1}
                      disabled={isStreaming}
                    />
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-2">
                        <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
                        <span className="sm:hidden">Enter to send</span>
                      </div>
                      <span>{newMessage.length}/1000</span>
                    </div>
                  </div>
                  
                  {isStreaming ? (
                    <Button variant="outline" onClick={stopStreaming} className="flex-shrink-0 min-w-[60px]">
                      <StopIcon className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Stop</span>
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => {
                        sendMessage();
                      }}
                      disabled={!newMessage.trim() || newMessage.length > 1000}
                      className="flex-shrink-0 min-w-[60px]"
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Send</span>
                    </Button>
                  )}
                </div>
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

      {/* Citation Modal */}
      {showCitationModal && selectedCitation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <DocumentTextIcon className="h-5 w-5 mr-3 text-blue-500" />
                Source Content
              </h3>
              <button
                onClick={() => setShowCitationModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 min-h-[44px] min-w-[44px] touch-target"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Source Content */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Content
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {selectedCitation.snippet || 'No content available'}
                  </p>
                </div>
                
                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Room
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedCitation.room_name || 'Unknown'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Time Period
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedCitation.time_span || 'Unknown'}
                    </p>
                  </div>
                </div>
                
                {/* Additional Info */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Source ID
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {selectedCitation.chunk_id || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCitationModal(false)}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 min-h-[44px] touch-target"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ADVANCED MARKDOWN RENDERER: Real-time streaming with rich formatting like Claude
const MarkdownRenderer: React.FC<{ content: string; isStreaming?: boolean }> = ({ content, isStreaming = false }) => {
  
  // Define renderInlineFormatting function first
  const renderInlineFormatting = useCallback((text: string) => {
    if (!text) return null;
    
    // Split by all inline patterns
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\)|~~.*?~~)/g);
    
    return parts.map((part, partIndex) => {
      // Bold text (**text**)
      const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
      if (boldMatch) {
        return <strong key={partIndex} className="font-semibold text-gray-900 dark:text-white">{boldMatch[1]}</strong>;
      }
      
      // Italic text (*text*)
      const italicMatch = part.match(/^\*(.*?)\*$/);
      if (italicMatch) {
        return <em key={partIndex} className="italic">{italicMatch[1]}</em>;
      }
      
      // Strikethrough (~~text~~)
      const strikeMatch = part.match(/^~~(.*?)~~$/);
      if (strikeMatch) {
        return <del key={partIndex} className="line-through opacity-75">{strikeMatch[1]}</del>;
      }
      
      // Inline code (`code`)
      const codeMatch = part.match(/^`(.*?)`$/);
      if (codeMatch) {
        return (
          <code key={partIndex} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600 dark:text-pink-400 border border-gray-200 dark:border-gray-700">
            {codeMatch[1]}
          </code>
        );
      }
      
      // Links ([text](url))
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a
            key={partIndex}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {linkMatch[1]}
          </a>
        );
      }
      
      // Regular text
      return <span key={partIndex}>{part}</span>;
    });
  }, []);
  
  const renderRichMarkdown = useMemo(() => {
    if (!content) return [];
    
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';
    let inList = false;
    let listItems: string[] = [];
    let listType = '';
    
    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const paragraphText = currentParagraph.join(' ').trim();
        if (paragraphText) {
          elements.push(
            <p key={elements.length} className="mb-4 leading-relaxed text-gray-900 dark:text-gray-100">
              {renderInlineFormatting(paragraphText)}
            </p>
          );
        }
        currentParagraph = [];
      }
    };
    
    const flushList = () => {
      if (listItems.length > 0) {
        const ListTag = listType === 'ordered' ? 'ol' : 'ul';
        elements.push(
          <ListTag key={elements.length} className={cn(
            "mb-4 space-y-2 ml-4",
            listType === 'ordered' ? "list-decimal" : "list-disc"
          )}>
            {listItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed text-gray-900 dark:text-gray-100 pl-1">
                {renderInlineFormatting(item)}
              </li>
            ))}
          </ListTag>
        );
        listItems = [];
        inList = false;
      }
    };
    
    const flushCodeBlock = () => {
      if (codeBlockContent.length > 0) {
        elements.push(
          <div key={elements.length} className="mb-4">
            <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto border border-gray-200 dark:border-gray-700">
              <code className="text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed">
                {codeBlockContent.join('\n')}
              </code>
            </pre>
          </div>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      }
    };
    
    lines.forEach((line, lineIndex) => {
      // Handle code blocks
      const codeBlockMatch = line.match(/^```(\w*)?/);
      if (codeBlockMatch) {
        if (!inCodeBlock) {
          flushParagraph();
          flushList();
          inCodeBlock = true;
          codeBlockLang = codeBlockMatch[1] || '';
        } else {
          flushCodeBlock();
        }
        return;
      }
      
      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }
      
      // Handle headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headerMatch) {
        flushParagraph();
        flushList();
        const level = headerMatch[1].length;
        const HeaderTag = `h${level}` as keyof JSX.IntrinsicElements;
        const headerStyles = {
          1: "text-2xl font-bold mb-4 mt-6 text-gray-900 dark:text-white",
          2: "text-xl font-bold mb-3 mt-5 text-gray-900 dark:text-white", 
          3: "text-lg font-semibold mb-3 mt-4 text-gray-900 dark:text-white",
          4: "text-base font-semibold mb-2 mt-3 text-gray-900 dark:text-white",
          5: "text-sm font-semibold mb-2 mt-3 text-gray-900 dark:text-white",
          6: "text-sm font-medium mb-2 mt-2 text-gray-700 dark:text-gray-300"
        };
        
        elements.push(
          <HeaderTag key={elements.length} className={headerStyles[level as keyof typeof headerStyles]}>
            {renderInlineFormatting(headerMatch[2])}
          </HeaderTag>
        );
        return;
      }
      
      // Handle numbered lists (1. 2. 3.)
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        flushParagraph();
        if (!inList || listType !== 'ordered') {
          flushList();
          inList = true;
          listType = 'ordered';
        }
        listItems.push(numberedMatch[2]);
        return;
      }
      
      // Handle bullet lists (- or *)
      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        flushParagraph();
        if (!inList || listType !== 'unordered') {
          flushList();
          inList = true;
          listType = 'unordered';
        }
        listItems.push(bulletMatch[1]);
        return;
      }
      
      // Handle blockquotes
      const blockquoteMatch = line.match(/^>\s*(.+)/);
      if (blockquoteMatch) {
        flushParagraph();
        flushList();
        elements.push(
          <blockquote key={elements.length} className="border-l-4 border-blue-400 pl-4 py-2 mb-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300">
            {renderInlineFormatting(blockquoteMatch[1])}
          </blockquote>
        );
        return;
      }
      
      // Handle horizontal rules
      if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
        flushParagraph();
        flushList();
        elements.push(
          <hr key={elements.length} className="my-6 border-gray-300 dark:border-gray-600" />
        );
        return;
      }
      
      // Handle empty lines
      if (line.trim() === '') {
        flushParagraph();
        flushList();
        return;
      }
      
      // Regular paragraph text
      if (inList) {
        flushList();
      }
      currentParagraph.push(line);
    });
    
    // Flush remaining content
    flushParagraph();
    flushList();
    flushCodeBlock();
    
    return elements;
  }, [content]);
  


  return (
    <div className="markdown-content prose prose-sm max-w-none dark:prose-invert">
      {renderRichMarkdown}
      {isStreaming && (
        <span className="inline-block w-0.5 h-5 bg-blue-500 opacity-75 animate-pulse ml-0.5 align-middle" />
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
        "w-full p-4 rounded-xl text-left transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[56px] touch-target border border-transparent hover:border-gray-200 dark:hover:border-gray-700",
        isSelected && "bg-[#ffe600]/10 border-[#ffe600]/30 shadow-sm"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate flex-1 mr-3">
          {conversation.title}
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 font-medium">
          {conversation.last_activity}
        </span>
      </div>
      {conversation.preview && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
          {conversation.preview}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">{conversation.message_count} messages</span>
        <span className="font-medium">{new Date(conversation.created_at).toLocaleDateString()}</span>
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
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div 
        data-message-id={message.id}
        className={cn(
          "max-w-[88%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-[80%] rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base whitespace-pre-wrap break-words overflow-hidden",
          isUser 
            ? "bg-[#ffe600] text-black" 
            : "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700"
        )}>
        
        {/* Message Content */}
        <div className="break-words overflow-hidden">
          {message.content === 'ATOM is thinking...' && message.status === 'streaming' ? (
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 dark:text-gray-400">ATOM is thinking</span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce opacity-70" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce opacity-70" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce opacity-70" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          ) : (
            <MarkdownRenderer 
              key={`${message.id}-${message.content.length}`}
              content={message.content} 
              isStreaming={message.status === 'streaming'} 
            />
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
        
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {message.status === 'error' && (
            <span className="text-red-500 dark:text-red-400 font-medium">Failed to send</span>
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
  return (
    <div className="citation-chip">
      <button
        onClick={() => {
          // Dispatch custom event to open citation modal
          window.dispatchEvent(new CustomEvent('showCitationModal', { detail: citation }));
        }}
        className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 transition-all duration-200 border border-blue-200 dark:border-blue-700/50 shadow-sm hover:shadow-md"
      >
        <DocumentTextIcon className="h-4 w-4 mr-2" />
        <span className="truncate max-w-32">{citation.room_name || 'Unknown Room'}</span>
        <span className="mx-2 text-blue-500">•</span>
        <span className="text-xs opacity-80">{citation.time_span || 'Unknown Time'}</span>
      </button>
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