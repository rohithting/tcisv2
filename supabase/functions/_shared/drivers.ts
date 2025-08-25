// Drivers & Values utility functions
// Handles loading rubrics and enforcing evaluation policies

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Driver {
  id: number;
  key: string;
  name: string;
  description: string;
  weight: number;
  client_id: number | null;
  negative_indicators: string[];
}

interface DriverBehavior {
  driver_id: number;
  positive_examples: string[];
  negative_examples: string[];
}

interface DriverInstance {
  title: string;
  takeaway: string;
}

interface EvaluationPolicy {
  id: number;
  name: string;
  guidance: string;
  min_evidence_items: number;
  require_citations: boolean;
  scale_min: number;
  scale_max: number;
  red_lines: string[];
}

interface DriversPayload {
  drivers: Driver[];
  behaviors: DriverBehavior[];
  instances: DriverInstance[];
  policy: EvaluationPolicy;
}

interface EvidencePolicy {
  min_evidence_items: number;
  min_rooms_required: number;
  require_citations: boolean;
  scale_min: number;
  scale_max: number;
}

interface PolicyCheckResult {
  ok: boolean;
  reason?: string;
}

class DriversManager {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }

  /**
   * Load complete drivers payload for a client
   */
  async getDriversPayload(clientId: number): Promise<DriversPayload> {
    try {
      // Load drivers, behaviors, and instance summaries
      const { data: driversData, error: driversError } = await this.supabase
        .from('drivers')
        .select(`
          id,
          key,
          name,
          description,
          weight,
          client_id,
          negative_indicators
        `)
        .or(`client_id.is.null,client_id.eq.${clientId}`)
        .eq('is_active', true)
        .order('weight', { ascending: false });

      if (driversError) {
        throw new Error(`Failed to load drivers: ${driversError.message}`);
      }

      // Load driver behaviors
      const { data: behaviorsData, error: behaviorsError } = await this.supabase
        .from('driver_behaviors')
        .select(`
          driver_id,
          positive_examples,
          negative_examples
        `)
        .in('driver_id', driversData.map(d => d.id));

      if (behaviorsError) {
        throw new Error(`Failed to load driver behaviors: ${behaviorsError.message}`);
      }

      // Load driver instances (title + takeaway only)
      const { data: instancesData, error: instancesError } = await this.supabase
        .from('driver_instances')
        .select(`
          driver_id,
          title,
          takeaway
        `)
        .in('driver_id', driversData.map(d => d.id))
        .order('created_at', { ascending: true });

      if (instancesError) {
        throw new Error(`Failed to load driver instances: ${instancesError.message}`);
      }

      // Load evaluation policy
      const { data: policyData, error: policyError } = await this.supabase
        .from('evaluation_policies')
        .select(`
          id,
          name,
          guidance,
          min_evidence_items,
          require_citations,
          scale_min,
          scale_max,
          red_lines
        `)
        .or(`client_id.is.null,client_id.eq.${clientId}`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (policyError) {
        // Use default policy if none found
        const defaultPolicy: EvaluationPolicy = {
          id: 0,
          name: 'Default Policy',
          guidance: 'Always provide evidence and cite messages. Use only retrieved chat evidence for scoring.',
          min_evidence_items: 3,
          require_citations: true,
          scale_min: 1,
          scale_max: 5,
          red_lines: []
        };
        return {
          drivers: driversData,
          behaviors: behaviorsData,
          instances: instancesData,
          policy: defaultPolicy
        };
      }

      return {
        drivers: driversData,
        behaviors: behaviorsData,
        instances: instancesData,
        policy: policyData
      };
    } catch (error) {
      console.error('Error loading drivers payload:', error);
      throw error;
    }
  }

  /**
   * Enforce evidence policy before calling Gemini
   */
  enforceEvidencePolicy(
    retrievedChunks: any[],
    policy: EvaluationPolicy
  ): PolicyCheckResult {
    try {
      // Check minimum evidence items
      if (retrievedChunks.length < policy.min_evidence_items) {
        return {
          ok: false,
          reason: `Insufficient evidence: found ${retrievedChunks.length} items, need at least ${policy.min_evidence_items}`
        };
      }

      // Check minimum rooms required (if policy specifies)
      if (policy.min_evidence_items > 1) {
        const uniqueRooms = new Set(retrievedChunks.map(chunk => chunk.room_id)).size;
        if (uniqueRooms < 2) {
          return {
            ok: false,
            reason: `Insufficient room diversity: evidence from ${uniqueRooms} room(s), need at least 2 different rooms`
          };
        }
      }

      return { ok: true };
    } catch (error) {
      console.error('Error enforcing evidence policy:', error);
      return {
        ok: false,
        reason: 'Error checking evidence policy'
      };
    }
  }

  /**
   * Compact evidence for Gemini prompt
   */
  compactEvidence(chunks: any[]): any[] {
    return chunks.map(chunk => ({
      chunk_id: chunk.id,
      room: chunk.room_name || 'Unknown Room',
      ts: chunk.first_ts || chunk.created_at,
      preview: chunk.text?.substring(0, 200) || 'No preview available'
    }));
  }

  /**
   * Validate and clamp evaluation scores
   */
  validateAndClamp(
    evaluationJson: any,
    policy: EvaluationPolicy,
    drivers: Driver[]
  ): any {
    try {
      const validated = { ...evaluationJson };

      // Validate scores array
      if (!validated.scores || !Array.isArray(validated.scores)) {
        throw new Error('Invalid scores array in evaluation');
      }

      // Clamp scores to policy range
      validated.scores = validated.scores.map((score: any) => ({
        ...score,
        score: Math.max(policy.scale_min, Math.min(policy.scale_max, score.score || 1)),
        weight: Math.max(0, Math.min(2, score.weight || 1.0))
      }));

      // Recompute weighted total
      let totalWeight = 0;
      let weightedSum = 0;

      validated.scores.forEach((score: any) => {
        totalWeight += score.weight;
        weightedSum += (score.score * score.weight);
      });

      validated.weighted_total = totalWeight > 0 ? weightedSum / totalWeight : 0;

      // Ensure confidence is within bounds
      if (validated.confidence !== undefined) {
        validated.confidence = Math.max(0, Math.min(1, validated.confidence));
      }

      return validated;
    } catch (error) {
      console.error('Error validating evaluation:', error);
      throw new Error('Invalid evaluation format');
    }
  }

  /**
   * Create short summary for evaluation mode
   */
  createShortSummary(evaluation: any): string {
    try {
      const scores = evaluation.scores || [];
      const avgScore = scores.length > 0 
        ? scores.reduce((sum: number, s: any) => sum + s.score, 0) / scores.length 
        : 0;

      const strengths = evaluation.strengths || [];
      const risks = evaluation.risks || [];

      let summary = `Evaluation complete. Average score: ${avgScore.toFixed(1)}/5. `;
      
      if (strengths.length > 0) {
        summary += `Key strengths: ${strengths.slice(0, 2).join(', ')}. `;
      }
      
      if (risks.length > 0) {
        summary += `Areas for attention: ${risks.slice(0, 2).join(', ')}. `;
      }

      return summary;
    } catch (error) {
      console.error('Error creating summary:', error);
      return 'Evaluation completed successfully.';
    }
  }
}

// Export singleton instance
export const driversManager = new DriversManager();

// Export types
export type {
  Driver,
  DriverBehavior,
  DriverInstance,
  EvaluationPolicy,
  DriversPayload,
  EvidencePolicy,
  PolicyCheckResult
};
