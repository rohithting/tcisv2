'use client';

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { api } from '@/lib/api-services';
import { getErrorMessage } from '@/lib/api-client';
import { UploadProgress } from '@/types/api';
import {
  DocumentArrowUpIcon,
  CloudArrowUpIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  DocumentTextIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

// SHA-256 calculation utility
async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'calculating' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  digest?: string;
  jobId?: number;
  error?: string;
  stats?: {
    conversations: number;
    participants: number;
    totalMessages: number;
    dateRange?: {
      start: string;
      end: string;
    };
  };
}

interface UploadWidgetProps {
  clientId: string;
  roomId: string;
  supabase: any; // Add supabase client
  onUploadComplete?: (jobId: number, fileName: string) => void;
  onUploadError?: (error: string, fileName: string) => void;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  className?: string;
}

export function UploadWidget({
  clientId,
  roomId,
  supabase,
  onUploadComplete,
  onUploadError,
  maxFileSize = 25,
  allowedTypes = ['.txt', '.log', '.csv'],
  className
}: UploadWidgetProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced file types
  const advancedTypes = ['.csv', '.json'];
  const currentAllowedTypes = showAdvanced ? [...allowedTypes, ...advancedTypes] : allowedTypes;

  const parseChatFile = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim());
    const conversations = new Set<string>();
    const participants = new Set<string>();
    const messages: Array<{ timestamp: string; sender: string; content: string }> = [];
    const dates = new Set<string>();

    // Common chat patterns
    const patterns = [
      // WhatsApp/Telegram style: [timestamp] Sender: message
      /^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s+([^:]+):\s*(.+)$/i,
      // Discord style: [timestamp] Sender: message
      /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s*(.+)$/i,
      // Generic timestamp pattern: YYYY-MM-DD HH:MM:SS
      /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+([^:]+):\s*(.+)$/i,
      // Date + time pattern: DD/MM/YYYY HH:MM
      /^(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})\s+([^:]+):\s*(.+)$/i,
      // Slack style: [timestamp] Sender: message
      /^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]+):\s*(.+)$/i,
      // Teams style: [timestamp] Sender: message
      /^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]+):\s*(.+)$/i,
      // Generic pattern: Sender: message (no timestamp)
      /^([^:]+):\s*(.+)$/i
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          let timestamp = '';
          let sender = '';
          let content = '';
          
          if (match.length === 4) {
            // Pattern with timestamp: [timestamp] sender: content
            [, timestamp, sender, content] = match;
          } else if (match.length === 3) {
            // Pattern without timestamp: sender: content
            [, sender, content] = match;
          }
          
          // Extract date from timestamp if available
          let date = '';
          if (timestamp) {
            if (timestamp.includes('-')) {
              date = timestamp.split(' ')[0]; // YYYY-MM-DD format
            } else if (timestamp.includes('/')) {
              const parts = timestamp.split(' ')[0].split('/');
              date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // Convert to YYYY-MM-DD
            } else {
              // For time-only timestamps, use current date as fallback
              date = new Date().toISOString().split('T')[0];
            }
          } else {
            // No timestamp, use current date
            date = new Date().toISOString().split('T')[0];
          }

          if (date) dates.add(date);
          
          // Clean sender name (remove common prefixes/suffixes)
          const cleanSender = sender.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
          if (cleanSender && cleanSender.length > 1) {
            participants.add(cleanSender);
          }
          
          // Count as message if content is substantial
          if (content.trim().length > 0) {
            messages.push({ timestamp: timestamp || 'No timestamp', sender: cleanSender, content: content.trim() });
          }
          
          break; // Found a match, move to next line
        }
      }
    }

    // Group by date to estimate conversations
    const dateGroups = Array.from(dates).sort();
    const estimatedConversations = Math.max(1, Math.ceil(dateGroups.length / 2)); // Rough estimate

    return {
      conversations: estimatedConversations,
      participants: participants.size,
      totalMessages: messages.length,
      dateRange: dateGroups.length > 0 ? {
        start: dateGroups[0],
        end: dateGroups[dateGroups.length - 1]
      } : undefined
    };
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }

    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!currentAllowedTypes.includes(extension)) {
      return `File type not supported. Allowed: ${currentAllowedTypes.join(', ')}`;
    }

    return null;
  };

  const processFile = async (file: File) => {
    const fileId = Math.random().toString(36).substring(7);
    const uploadFile: UploadFile = {
      file,
      id: fileId,
      status: 'pending',
      progress: 0,
    };

    setFiles(prev => [...prev, uploadFile]);

    try {
      // Step 1: Calculate SHA-256 digest
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'calculating' as const, progress: 10 } : f
      ));

      const digest = await calculateSHA256(file);
      
      // Parse chat file to extract statistics
      const fileContent = await file.text();
      const stats = parseChatFile(fileContent);
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, digest, stats, progress: 20 } : f
      ));

      // Step 2: Get signed upload URL
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'uploading' as const, progress: 30 } : f
      ));

      const requestData = {
        client_id: parseInt(clientId),
        room_id: parseInt(roomId),
        file_name: file.name,
        file_digest: digest,
      };

      const uploadUrlResponse = await api.uploads.requestUploadUrl(supabase, requestData);

      const { signed_url, job_id } = uploadUrlResponse;

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, jobId: job_id, progress: 40 } : f
      ));

      // Step 3: Upload file to signed URL
      const uploadResponse = await fetch(signed_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 70 } : f
      ));

      // Step 4: Trigger ingestion
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'processing' as const, progress: 80 } : f
      ));

      await api.uploads.confirmIngest(supabase, { job_id });

      // Complete
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'completed' as const, progress: 100 } : f
      ));

      onUploadComplete?.(job_id, file.name);

    } catch (error: any) {
      console.error('❌ DEBUG - Upload error:', error);
      console.error('❌ DEBUG - Error type:', typeof error);
      console.error('❌ DEBUG - Error keys:', Object.keys(error || {}));
      
      const errorMessage = getErrorMessage(error);
      console.error('❌ DEBUG - Formatted error message:', errorMessage);
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'error' as const, error: errorMessage } : f
      ));
      onUploadError?.(errorMessage, file.name);
    }
  };

  const handleFileSelect = useCallback((selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        onUploadError?.(error, file.name);
        continue;
      }
      processFile(file);
    }
  }, [clientId, roomId, maxFileSize, currentAllowedTypes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const retryFile = (fileId: string) => {
    const uploadFile = files.find(f => f.id === fileId);
    if (uploadFile) {
      setFiles(prev => prev.filter(f => f.id !== fileId));
      processFile(uploadFile.file);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Upload Zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200",
          isDragOver
            ? "border-[#ffe600] bg-[#ffe600]/5 scale-105"
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={currentAllowedTypes.join(',')}
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-2xl flex items-center justify-center mx-auto">
            <CloudArrowUpIcon className="h-8 w-8 text-[#ffe600]" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Drop files here or click to browse
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Supported formats: {currentAllowedTypes.join(', ')} • Max size: {maxFileSize}MB
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-6 py-3 bg-[#ffe600] text-black font-medium rounded-xl hover:bg-[#ffd700] transition-colors duration-200"
          >
            <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
            Select Files
          </button>
        </div>
      </div>

      {/* Advanced Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <div className="flex items-center space-x-2">
          <InformationCircleIcon className="h-5 w-5 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Advanced file types (.csv, .json)
          </span>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
            showAdvanced ? "bg-[#ffe600]" : "bg-gray-200 dark:bg-gray-700"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200",
              showAdvanced ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload Progress
          </h4>
          <div className="space-y-3">
            {files.map((uploadFile) => (
              <FileUploadCard
                key={uploadFile.id}
                uploadFile={uploadFile}
                onRemove={() => removeFile(uploadFile.id)}
                onRetry={() => retryFile(uploadFile.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FileUploadCardProps {
  uploadFile: UploadFile;
  onRemove: () => void;
  onRetry: () => void;
}

function FileUploadCard({ uploadFile, onRemove, onRetry }: FileUploadCardProps) {
  const { file, status, progress, error, jobId } = uploadFile;

  const statusConfig = {
    pending: { color: 'text-gray-500', bg: 'bg-gray-100', icon: DocumentTextIcon },
    calculating: { color: 'text-blue-600', bg: 'bg-blue-100', icon: ArrowPathIcon },
    uploading: { color: 'text-[#ffe600]', bg: 'bg-[#ffe600]/10', icon: CloudArrowUpIcon },
    processing: { color: 'text-purple-600', bg: 'bg-purple-100', icon: ArrowPathIcon },
    completed: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircleIcon },
    error: { color: 'text-red-600', bg: 'bg-red-100', icon: ExclamationCircleIcon },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className={cn("p-2 rounded-lg", config.bg)}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {file.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(file.size / 1024 / 1024).toFixed(2)} MB • {status === 'calculating' ? 'parsing file...' : status.replace('_', ' ')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {status === 'error' && (
            <button
              onClick={onRetry}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          )}
          {(status === 'error' || status === 'completed') && (
            <button
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {status !== 'completed' && status !== 'error' && (
        <div className="mb-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-[#ffe600] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Chat Statistics */}
      {uploadFile.stats && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="text-center">
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                {uploadFile.stats.conversations}
              </div>
              <div className="text-blue-500 dark:text-blue-300">Conversations</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                {uploadFile.stats.participants}
              </div>
              <div className="text-blue-500 dark:text-blue-300">Participants</div>
            </div>
            <div className="text-center col-span-2">
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                {uploadFile.stats.totalMessages.toLocaleString()}
              </div>
              <div className="text-blue-500 dark:text-blue-300">Total Messages</div>
            </div>
            {uploadFile.stats.dateRange && (
              <div className="text-center col-span-2">
                <div className="text-blue-500 dark:text-blue-300 text-xs">
                  {uploadFile.stats.dateRange.start} → {uploadFile.stats.dateRange.end}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {/* Success Info */}
      {status === 'completed' && jobId && (
        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-xs text-green-600 dark:text-green-400">
            Upload successful! Job ID: {jobId}
          </p>
        </div>
      )}
    </div>
  );
}
