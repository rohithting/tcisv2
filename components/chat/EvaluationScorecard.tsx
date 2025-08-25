'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  StarIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface Citation {
  id: string;
  room_name: string;
  time_span: string;
  snippet: string;
  chunk_id: string;
}

interface DriverResult {
  name: string;
  weight: number;
  score: number; // 1-5 scale
  rationale: string;
  citations: Citation[];
  insufficient_evidence?: boolean;
  missing_citations?: boolean;
}

interface EvaluationResult {
  summary: {
    weighted_total: number;
    confidence: number;
  };
  drivers: DriverResult[];
  recommendations: string[];
  subject_user: string;
  evaluation_timestamp: string;
  result_json?: any;
}

interface EvaluationScorecardProps {
  evaluation: EvaluationResult;
  className?: string;
}

export function EvaluationScorecard({ evaluation, className }: EvaluationScorecardProps) {
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [showCitationPreview, setShowCitationPreview] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
    if (score >= 3.5) return 'text-[#ffe600] dark:text-[#ffe600] bg-[#ffe600]/10';
    if (score >= 2.5) return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20';
    return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 dark:text-green-400';
    if (confidence >= 60) return 'text-[#ffe600] dark:text-[#ffe600]';
    return 'text-red-600 dark:text-red-400';
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify(evaluation.result_json || evaluation, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evaluation-${evaluation.subject_user}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderStars = (score: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <div key={star} className="relative">
            {score >= star ? (
              <StarIconSolid className="h-4 w-4 text-[#ffe600]" />
            ) : (
              <StarIcon className="h-4 w-4 text-gray-300 dark:text-gray-600" />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
          {score.toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm", className)}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-[#ffe600]/10 to-[#ffe600]/5 rounded-xl">
              <ChartBarIcon className="h-6 w-6 text-[#ffe600]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Evaluation Results
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Subject: <span className="font-medium">{evaluation.subject_user}</span> • 
                {new Date(evaluation.evaluation_timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={exportJSON}>
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-[#ffe600]/5 to-[#ffe600]/10 rounded-xl">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {evaluation.summary.weighted_total.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Weighted Total Score
            </div>
            {renderStars(evaluation.summary.weighted_total)}
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className={cn(
              "text-3xl font-bold mb-2",
              getConfidenceColor(evaluation.summary.confidence)
            )}>
              {evaluation.summary.confidence}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Confidence Level
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  evaluation.summary.confidence >= 80 ? "bg-green-500" :
                  evaluation.summary.confidence >= 60 ? "bg-[#ffe600]" : "bg-red-500"
                )}
                style={{ width: `${evaluation.summary.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Driver Results */}
      <div className="p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Driver Analysis
        </h4>
        
        <div className="space-y-4">
          {evaluation.drivers.map((driver, index) => (
            <DriverCard
              key={`${driver.name}-${index}`}
              driver={driver}
              isExpanded={expandedDriver === `${driver.name}-${index}`}
              onToggle={() => setExpandedDriver(
                expandedDriver === `${driver.name}-${index}` ? null : `${driver.name}-${index}`
              )}
              showCitationPreview={showCitationPreview}
              setShowCitationPreview={setShowCitationPreview}
            />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {evaluation.recommendations && evaluation.recommendations.length > 0 && (
        <div className="p-6 border-t border-gray-200 dark:border-gray-800">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <ShieldCheckIcon className="h-5 w-5 mr-2 text-[#ffe600]" />
            Recommendations
          </h4>
          <ul className="space-y-3">
            {evaluation.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-[#ffe600] rounded-full mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {recommendation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface DriverCardProps {
  driver: DriverResult;
  isExpanded: boolean;
  onToggle: () => void;
  showCitationPreview: string | null;
  setShowCitationPreview: (id: string | null) => void;
}

function DriverCard({ 
  driver, 
  isExpanded, 
  onToggle,
  showCitationPreview,
  setShowCitationPreview 
}: DriverCardProps) {
  const scoreColorClass = driver.score >= 4.5 ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20' :
                         driver.score >= 3.5 ? 'text-[#ffe600] dark:text-[#ffe600] bg-[#ffe600]/10' :
                         driver.score >= 2.5 ? 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20' :
                         'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';

  const hasIssues = driver.insufficient_evidence || driver.missing_citations;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h5 className="font-semibold text-gray-900 dark:text-white">
                {driver.name}
              </h5>
              {hasIssues && (
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />
              )}
            </div>
            
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Weight: {(driver.weight * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {driver.missing_citations ? (
              <div className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-medium rounded-full">
                Missing Citations
              </div>
            ) : driver.insufficient_evidence ? (
              <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full">
                Insufficient Evidence
              </div>
            ) : (
              <div className={cn("px-3 py-1 text-sm font-medium rounded-full", scoreColorClass)}>
                {driver.score.toFixed(1)}/5
              </div>
            )}
          </div>
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
          {/* Score Display */}
          {!driver.missing_citations && !driver.insufficient_evidence && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Score
                </span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIconSolid
                      key={star}
                      className={cn(
                        "h-4 w-4",
                        driver.score >= star ? "text-[#ffe600]" : "text-gray-300 dark:text-gray-600"
                      )}
                    />
                  ))}
                  <span className="ml-2 text-sm font-bold text-gray-900 dark:text-white">
                    {driver.score.toFixed(1)}/5
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Rationale */}
          <div className="mb-4">
            <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Analysis
            </h6>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {driver.rationale}
            </p>
          </div>

          {/* Citations */}
          {driver.citations && driver.citations.length > 0 && (
            <div>
              <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Evidence ({driver.citations.length} citation{driver.citations.length !== 1 ? 's' : ''})
              </h6>
              <div className="space-y-2">
                {driver.citations.map((citation) => (
                  <CitationCard
                    key={citation.id}
                    citation={citation}
                    showPreview={showCitationPreview === citation.id}
                    onTogglePreview={() => setShowCitationPreview(
                      showCitationPreview === citation.id ? null : citation.id
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Issue Messages */}
          {driver.insufficient_evidence && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <InformationCircleIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Insufficient Evidence
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Not enough evidence was found to provide a reliable score for this driver. 
                Consider uploading more relevant chat data or adjusting the evaluation criteria.
              </p>
            </div>
          )}

          {driver.missing_citations && (
            <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center space-x-2 mb-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                  Missing Citations
                </span>
              </div>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                This driver result lacks proper citations. The evaluation may be unreliable 
                without supporting evidence from the chat data.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CitationCardProps {
  citation: Citation;
  showPreview: boolean;
  onTogglePreview: () => void;
}

function CitationCard({ citation, showPreview, onTogglePreview }: CitationCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onTogglePreview}
        className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DocumentTextIcon className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {citation.room_name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {citation.time_span}
            </span>
          </div>
          <div className="text-xs text-gray-400">
            {showPreview ? 'Hide' : 'Show'} snippet
          </div>
        </div>
      </button>
      
      {showPreview && (
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-700">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">
              "{citation.snippet}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
