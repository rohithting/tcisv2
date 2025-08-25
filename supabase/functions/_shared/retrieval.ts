/**
 * Retrieval and search utilities for RAG implementation
 */

export interface RetrievalFilters {
  types?: string[];
  room_ids?: string[];
  date_from?: string;
  date_to?: string;
  participants?: string[];
}

export interface ChunkCandidate {
  chunk_id: string;
  room_id: string;
  room_name: string;
  room_type: string;
  text: string;
  first_ts: string;
  last_ts: string;
  participants: string[];
  score?: number;
  source: 'vector' | 'text' | 'hybrid';
}

export interface Citation {
  chunk_id: string;
  room_id: string;
  room_name: string;
  room_type: string;
  first_ts: string;
  last_ts: string;
  preview: string;
  score?: number;
}

/**
 * Build SQL query for candidate chunks with filters
 */
export function buildCandidateQuery(
  supabase: any,
  clientId: string,
  filters: RetrievalFilters,
  limit: number = 20000
) {
  let query = supabase
    .from('chunks')
    .select(`
      id,
      room_id,
      text,
      first_ts,
      last_ts,
      participants,
      rooms!inner(
        id,
        name,
        type
      )
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Apply room type filter
  if (filters.types && filters.types.length > 0) {
    query = query.in('rooms.type', filters.types);
  }

  // Apply specific room filter
  if (filters.room_ids && filters.room_ids.length > 0) {
    query = query.in('room_id', filters.room_ids);
  }

  // Apply date filters
  if (filters.date_from) {
    query = query.gte('last_ts', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('first_ts', filters.date_to);
  }

  // Apply participant filter (PostgreSQL array overlap)
  if (filters.participants && filters.participants.length > 0) {
    query = query.overlaps('participants', filters.participants);
  }

  return query;
}

/**
 * Perform vector similarity search
 */
export async function vectorSearch(
  supabase: any,
  clientId: string,
  queryVector: number[],
  candidateChunkIds: string[],
  limit: number = 50
): Promise<ChunkCandidate[]> {
  // Note: This is a simplified implementation
  // In production, you would use pgvector with proper embedding similarity
  const { data: embeddings, error } = await supabase
    .from('embeddings')
    .select(`
      chunk_id,
      similarity_score,
      chunks!inner(
        id,
        room_id,
        text,
        first_ts,
        last_ts,
        participants,
        rooms!inner(
          id,
          name,
          type
        )
      )
    `)
    .eq('client_id', clientId)
    .in('chunk_id', candidateChunkIds)
    .order('similarity_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Vector search error:', error);
    return [];
  }

  return embeddings?.map((emb: any) => ({
    chunk_id: emb.chunk_id,
    room_id: emb.chunks.room_id,
    room_name: emb.chunks.rooms.name,
    room_type: emb.chunks.rooms.type,
    text: emb.chunks.text,
    first_ts: emb.chunks.first_ts,
    last_ts: emb.chunks.last_ts,
    participants: emb.chunks.participants,
    score: emb.similarity_score,
    source: 'vector',
  })) || [];
}

/**
 * Perform text-based search using PostgreSQL full-text search
 */
export async function textSearch(
  supabase: any,
  clientId: string,
  query: string,
  candidateChunkIds: string[],
  limit: number = 50
): Promise<ChunkCandidate[]> {
  // Use PostgreSQL's similarity function for text search
  const { data: chunks, error } = await supabase
    .rpc('search_chunks_by_text', {
      p_client_id: clientId,
      p_query: query,
    p_chunk_ids: candidateChunkIds,
      p_limit: limit,
    });

  if (error) {
    console.error('Text search error:', error);
    return [];
  }

  return chunks?.map((chunk: any) => ({
    chunk_id: chunk.id,
    room_id: chunk.room_id,
    room_name: chunk.room_name,
    room_type: chunk.room_type,
    text: chunk.text,
    first_ts: chunk.first_ts,
    last_ts: chunk.last_ts,
    participants: chunk.participants,
    score: chunk.similarity_score,
    source: 'text',
  })) || [];
}

/**
 * Maximal Marginal Relevance (MMR) reranking for diversity
 */
export function mmrRerank(
  candidates: ChunkCandidate[],
  lambda: number = 0.7,
  maxResults: number = 12
): ChunkCandidate[] {
  if (candidates.length <= maxResults) {
    return candidates;
  }

  const selected: ChunkCandidate[] = [];
  const remaining = [...candidates];

  // Select the highest scoring candidate first
  if (remaining.length > 0) {
    const best = remaining.reduce((a, b) => (a.score || 0) > (b.score || 0) ? a : b);
    selected.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }

  // Iteratively select candidates that maximize MMR score
  while (selected.length < maxResults && remaining.length > 0) {
    let bestCandidate: ChunkCandidate | null = null;
    let bestScore = -Infinity;

    for (const candidate of remaining) {
      // Relevance score (higher is better)
      const relevanceScore = candidate.score || 0;

      // Diversity score (lower similarity to selected items is better)
      let maxSimilarity = 0;
      for (const selectedItem of selected) {
        const similarity = calculateTextSimilarity(candidate.text, selectedItem.text);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // MMR score: balance relevance and diversity
      const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      selected.push(bestCandidate);
      remaining.splice(remaining.indexOf(bestCandidate), 1);
    } else {
      break;
    }
  }

  return selected;
}

/**
 * Simple text similarity calculation (Jaccard similarity on words)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Convert chunks to citations for response
 */
export function createCitations(chunks: ChunkCandidate[]): Citation[] {
  return chunks.map(chunk => ({
    chunk_id: chunk.chunk_id,
    room_id: chunk.room_id,
    room_name: chunk.room_name,
    room_type: chunk.room_type,
    first_ts: chunk.first_ts,
    last_ts: chunk.last_ts,
    preview: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
    score: chunk.score,
  }));
}

/**
 * Hybrid search combining vector and text search
 */
export async function hybridSearch(
  supabase: any,
  clientId: string,
  question: string,
  filters: RetrievalFilters,
  queryVector?: number[]
): Promise<{ candidates: ChunkCandidate[]; citations: Citation[] }> {
  // Step 1: Get candidate chunks with filters
  const candidateQuery = buildCandidateQuery(supabase, clientId, filters);
  const { data: candidateChunks, error: candidateError } = await candidateQuery;

  if (candidateError || !candidateChunks) {
    throw new Error(`Failed to retrieve candidate chunks: ${candidateError?.message}`);
  }

  const candidateChunkIds = candidateChunks.map((chunk: any) => chunk.id);

  if (candidateChunkIds.length === 0) {
    return { candidates: [], citations: [] };
  }

  // Step 2: Perform vector and text searches in parallel
  const [vectorResults, textResults] = await Promise.all([
    queryVector ? vectorSearch(supabase, clientId, queryVector, candidateChunkIds) : Promise.resolve([]),
    textSearch(supabase, clientId, question, candidateChunkIds),
  ]);

  // Step 3: Combine and deduplicate results
  const combinedResults = new Map<string, ChunkCandidate>();

  // Add vector results
  vectorResults.forEach(result => {
    combinedResults.set(result.chunk_id, result);
  });

  // Add text results (merge scores if chunk already exists)
  textResults.forEach(result => {
    const existing = combinedResults.get(result.chunk_id);
    if (existing) {
      // Combine scores from both methods
      existing.score = ((existing.score || 0) + (result.score || 0)) / 2;
      existing.source = 'hybrid';
    } else {
      combinedResults.set(result.chunk_id, result);
    }
  });

  // Step 4: Convert to array and sort by score
  const allCandidates = Array.from(combinedResults.values())
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // Step 5: Apply MMR reranking for diversity
  const rerankedCandidates = mmrRerank(allCandidates, 0.7, 12);

  // Step 6: Create citations
  const citations = createCitations(rerankedCandidates);

  return {
    candidates: rerankedCandidates,
    citations,
  };
}
