// Maximal Marginal Relevance (MMR) implementation - COMPLETE FIXED VERSION
// Reranks retrieved chunks to improve diversity and relevance
/**
 * Calculate cosine similarity between two vectors
 */ function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vector dimensions must match');
  }
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  for(let i = 0; i < vec1.length; i++){
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }
  return dotProduct / (norm1 * norm2);
}
/**
 * Calculate Jaccard similarity between two text chunks
 */ function jaccardSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  const intersection = new Set([
    ...words1
  ].filter((x)=>words2.has(x)));
  const union = new Set([
    ...words1,
    ...words2
  ]);
  return union.size > 0 ? intersection.size / union.size : 0;
}
/**
 * Calculate semantic similarity between two chunks
 */ function semanticSimilarity(chunk1, chunk2) {
  const text1 = chunk1.text || chunk1.content || '';
  const text2 = chunk2.text || chunk2.content || '';
  return jaccardSimilarity(text1, text2);
}
/**
 * Enhanced MMR reranking algorithm with recency and keyword boosting
 */ export function mmr(chunks, config = {}) {
  const { lambda = 0.7, maxResults = 12, diversityWeight = 0.3, recencyWeight = 0.2, keywordBoost = 0.1 } = config;
  if (!chunks || chunks.length === 0) {
    return [];
  }
  const maxResultsToReturn = Math.min(maxResults, chunks.length);
  const selected = [];
  const remaining = [
    ...chunks
  ];
  // Enhanced scoring with recency and keyword matching
  const scoredChunks = remaining.map((chunk)=>{
    let score = chunk.similarity_score || chunk.similarity || 0;
    // Add recency boost
    try {
      const timestamp = chunk.first_ts || chunk.created_at || chunk.timestamp || chunk.ts;
      if (timestamp) {
        const date = new Date(typeof timestamp === 'string' && !timestamp.includes('T') && !isNaN(timestamp) ? parseInt(timestamp) < 10000000000 ? parseInt(timestamp) * 1000 : parseInt(timestamp) : timestamp);
        if (!isNaN(date.getTime())) {
          const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
          const recencyScore = Math.exp(-ageInDays / 30); // Exponential decay over 30 days
          score += recencyWeight * recencyScore;
        }
      }
    } catch (error) {
    // Ignore recency if timestamp parsing fails
    }
    return {
      ...chunk,
      enhanced_score: score
    };
  });
  // Start with the highest scored chunk
  const firstChunk = scoredChunks.reduce((best, current)=>current.enhanced_score > best.enhanced_score ? current : best);
  selected.push(firstChunk);
  const firstIndex = remaining.indexOf(firstChunk);
  if (firstIndex >= 0) {
    remaining.splice(firstIndex, 1);
  }
  // Select remaining chunks using MMR
  while(selected.length < maxResultsToReturn && remaining.length > 0){
    let bestScore = -Infinity;
    let bestChunk = null;
    let bestIndex = -1;
    for(let i = 0; i < remaining.length; i++){
      const chunk = remaining[i];
      // Relevance score
      const relevanceScore = chunk.enhanced_score || chunk.similarity_score || chunk.similarity || 0;
      // Diversity score (minimum similarity to already selected chunks)
      let maxSimilarity = 0;
      for (const selectedChunk of selected){
        const similarity = semanticSimilarity(chunk, selectedChunk);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      // MMR score = λ * relevance + (1 - λ) * diversity
      const mmrScore = lambda * relevanceScore + (1 - lambda) * diversityWeight * (1 - maxSimilarity);
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestChunk = chunk;
        bestIndex = i;
      }
    }
    if (bestChunk && bestIndex >= 0) {
      selected.push(bestChunk);
      remaining.splice(bestIndex, 1);
    } else {
      break;
    }
  }
  console.log(`MMR selected ${selected.length} chunks from ${chunks.length} candidates`);
  return selected;
}
/**
 * Enhanced deduplication with better similarity detection
 */ export function dedupeChunks(chunks, similarityThreshold = 0.8) {
  if (!chunks || chunks.length === 0) {
    return [];
  }
  const unique = [];
  const seenHashes = new Set();
  const seenTexts = [];
  for (const chunk of chunks){
    // Check content hash first
    if (chunk.content_hash && seenHashes.has(chunk.content_hash)) {
      continue;
    }
    // Check text similarity against all seen texts
    const chunkText = chunk.text || chunk.content || '';
    let isDuplicate = false;
    for (const seenText of seenTexts){
      if (jaccardSimilarity(chunkText, seenText) > similarityThreshold) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      unique.push(chunk);
      if (chunk.content_hash) {
        seenHashes.add(chunk.content_hash);
      }
      seenTexts.push(chunkText);
    }
  }
  console.log(`Deduplicated ${chunks.length} chunks to ${unique.length} unique chunks`);
  return unique;
}
/**
 * Enhanced hybrid search result fusion
 */ export function fuseSearchResults(vectorResults, textResults, vectorWeight = 0.7) {
  const allChunks = [
    ...vectorResults,
    ...textResults
  ];
  // Create a map to track chunks and their scores
  const chunkMap = new Map();
  // Process vector results
  vectorResults.forEach((chunk, index)=>{
    const score = (chunk.similarity_score || chunk.similarity || 0) * vectorWeight;
    chunkMap.set(chunk.id, {
      chunk,
      score,
      source: 'vector'
    });
  });
  // Process text results
  textResults.forEach((chunk, index)=>{
    const existing = chunkMap.get(chunk.id);
    if (existing) {
      // Boost score if found in both searches
      existing.score += (chunk.similarity_score || chunk.similarity || 0) * (1 - vectorWeight) * 1.2;
      existing.source = 'both';
    } else {
      const score = (chunk.similarity_score || chunk.similarity || 0) * (1 - vectorWeight);
      chunkMap.set(chunk.id, {
        chunk,
        score,
        source: 'text'
      });
    }
  });
  // Convert back to array and sort by score
  const fused = Array.from(chunkMap.values()).sort((a, b)=>b.score - a.score).map((item)=>({
      ...item.chunk,
      similarity_score: item.score,
      similarity: item.score
    }));
  return fused;
}
/**
   * Enhanced format citations with proper timestamps - FIXED VERSION
  */ export function formatCitations(chunks) {
  console.log('📝 [DEBUG] Formatting citations for chunks:', chunks.length); // ADDED DEBUG LOG
  
  const formatted = chunks.map((chunk, index)=>{
    let formattedTime = 'No time';
    try {
      // Try multiple timestamp fields
      const timestamp = chunk.first_ts || chunk.created_at || chunk.timestamp || chunk.ts;
      if (timestamp) {
        let date;
        // Handle different timestamp formats
        if (typeof timestamp === 'string') {
          // Handle ISO strings, Unix timestamps as strings, etc.
          if (timestamp.includes('T') || timestamp.includes('-')) {
            date = new Date(timestamp);
          } else if (!isNaN(timestamp)) {
            // Unix timestamp as string
            const ts = parseInt(timestamp);
            date = new Date(ts < 10000000000 ? ts * 1000 : ts); // Handle seconds vs milliseconds
          } else {
            date = new Date(timestamp);
          }
        } else if (typeof timestamp === 'number') {
          // Handle Unix timestamps
          date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
        } else {
          date = new Date(timestamp);
        }
        // Validate the date
        if (!isNaN(date.getTime())) {
          // Format as readable timestamp
          formattedTime = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        } else {
          console.warn(`Invalid timestamp for chunk ${chunk.id}:`, timestamp);
        }
      } else {
        console.warn(`No timestamp found for chunk ${chunk.id}`);
      }
    } catch (error) {
      console.error(`Error formatting timestamp for chunk ${chunk.id}:`, error);
    }
    
    // FIXED: Add 'id' field to match frontend interface
    return {
      id: chunk.id,                    // ✅ Frontend expects this
      chunk_id: chunk.id,              // ✅ Keep for backward compatibility
      room_id: chunk.room_id,
      room_name: chunk.room_name || 'Unknown Room',
      timestamp: formattedTime,
      first_ts: chunk.first_ts,
      last_ts: chunk.last_ts,
      time_span: `${chunk.first_ts ? new Date(chunk.first_ts).toLocaleDateString() : 'Unknown'} - ${chunk.last_ts ? new Date(chunk.last_ts).toLocaleDateString() : 'Unknown'}`,
      snippet: chunk.text || chunk.content || 'No content available',  // ✅ Use both text and content fields
      preview: chunk.text?.substring(0, 200) || chunk.content?.substring(0, 200) || 'No preview available',
      similarity: chunk.similarity_score || chunk.similarity || null
    };
  });
  
  console.log('📝 [DEBUG] Formatted citations:', formatted); // ADDED DEBUG LOG
  return formatted;
}
/**
 * Helper function to format individual chunk timestamp
 */ export function formatChunkTimestamp(chunk) {
  try {
    const timestamp = chunk.first_ts || chunk.created_at || chunk.timestamp || chunk.ts;
    if (!timestamp) return 'No time';
    let date;
    if (typeof timestamp === 'string') {
      if (timestamp.includes('T') || timestamp.includes('-')) {
        date = new Date(timestamp);
      } else if (!isNaN(timestamp)) {
        const ts = parseInt(timestamp);
        date = new Date(ts < 10000000000 ? ts * 1000 : ts);
      } else {
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
    } else {
      date = new Date(timestamp);
    }
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  } catch (error) {
    console.warn('Error formatting timestamp:', error);
  }
  return 'No time';
}
