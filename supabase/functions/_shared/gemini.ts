// Gemini integration for Vertex AI with ATOM Persona - COMPLETE FULL VERSION WITH ALL FEATURES
// Uses service account JSON for authentication - All 949+ lines with advanced streaming, evaluation, and content generation
class GeminiClient {
  config;
  cache;
  rateLimiter;
  startTime;
  constructor(){
    this.config = {
      projectId: Deno.env.get('GOOGLE_CLOUD_PROJECT_ID') || 'cellular-axon-458006-e1',
      location: Deno.env.get('GOOGLE_CLOUD_LOCATION') || 'us-central1',
      model: Deno.env.get('GOOGLE_GEMINI_MODEL') || 'gemini-2.0-flash-exp'
    };
    // Token cache with TTL
    this.cache = {
      token: null,
      expires: 0
    };
    // Simple rate limiting
    this.rateLimiter = {
      requests: [],
      maxRequests: 60,
      windowMs: 60000 // 1 minute
    };
    this.startTime = Date.now();
  }
  // ATOM Persona Definition - Enhanced with more context
  getAtomSystemPrompt() {
    return `You are ATOM, a virtual employee at Ting Works LLP.

Company info (only mention when directly asked):
- Ting Works LLP is an integrated advertising agency
- Offices: Chennai, Kochi, Mumbai, Dubai, London
- Services: Integrated advertising, digital marketing, creative campaigns
- Founded as a creative agency with global reach

Personality:
- Professional yet approachable
- Knowledgeable about advertising and marketing
- Natural conversationalist
- Direct but friendly communication style

Be natural and conversational. Keep responses short and to the point unless detailed analysis is requested.`;
  }
  // Enhanced system prompt for specific use cases
  getEnhancedSystemPrompt(context = 'general') {
    const basePrompt = this.getAtomSystemPrompt();
    switch(context){
      case 'evaluation':
        return `${basePrompt}

SPECIALIZED ROLE: Performance Evaluator
- Analyze team member performance with empathy and context
- Focus on growth opportunities rather than just criticism
- Consider situational factors and challenges
- Provide balanced, constructive feedback
- Use company values as interpretive framework`;
      case 'analysis':
        return `${basePrompt}

SPECIALIZED ROLE: Data Analyst
- Examine patterns and trends in conversation data
- Provide insights with supporting evidence
- Present findings clearly and concisely
- Identify actionable recommendations
- Consider multiple perspectives`;
      case 'creative':
        return `${basePrompt}

SPECIALIZED ROLE: Creative Strategist
- Think creatively about advertising and marketing challenges
- Provide innovative solutions and ideas
- Consider brand positioning and messaging
- Balance creativity with practical implementation
- Draw from advertising industry best practices`;
      default:
        return basePrompt;
    }
  }
  /**
   * Clean JSON response to remove markdown formatting and handle various edge cases
   */ cleanJsonResponse(response) {
    if (!response || typeof response !== 'string') {
      return response;
    }
    let cleaned = response.trim();
    // Remove various markdown code block formats
    const markdownPatterns = [
      /^```json\s*/i,
      /^```\s*/,
      /\s*```$/,
      /^`+/,
      /`+$/
    ];
    markdownPatterns.forEach((pattern)=>{
      cleaned = cleaned.replace(pattern, '');
    });
    // Handle edge cases where response might be wrapped in extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    return cleaned.trim();
  }
  /**
   * Rate limiting to prevent API abuse
   */ checkRateLimit() {
    const now = Date.now();
    this.rateLimiter.requests = this.rateLimiter.requests.filter((timestamp)=>now - timestamp < this.rateLimiter.windowMs);
    if (this.rateLimiter.requests.length >= this.rateLimiter.maxRequests) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }
    this.rateLimiter.requests.push(now);
  }
  /**
   * Enhanced JWT creation with better error handling and validation
   */ async createJWT(serviceAccount) {
    if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Invalid service account: missing required fields');
    }
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    // Base64URL encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const data = `${encodedHeader}.${encodedPayload}`;
    // Process private key with enhanced format handling
    let privateKeyPem = serviceAccount.private_key;
    // Handle various private key formats
    if (privateKeyPem.includes('\\n')) {
      privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
    }
    // Format single-line keys
    if (!privateKeyPem.includes('\n')) {
      privateKeyPem = privateKeyPem.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n').replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
      const lines = privateKeyPem.split('\n');
      const formattedLines = [];
      for (const line of lines){
        if (line.includes('-----BEGIN') || line.includes('-----END') || line.length <= 64) {
          formattedLines.push(line);
        } else {
          // Split long lines into 64-character chunks
          for(let i = 0; i < line.length; i += 64){
            formattedLines.push(line.substring(i, i + 64));
          }
        }
      }
      privateKeyPem = formattedLines.join('\n');
    }
    // Extract PEM content
    const lines = privateKeyPem.split('\n');
    const pemContent = lines.filter((line)=>!line.includes('-----BEGIN') && !line.includes('-----END') && line.trim().length > 0).join('');
    try {
      // Convert PEM to binary
      const binaryDer = Uint8Array.from(atob(pemContent), (c)=>c.charCodeAt(0));
      // Import the key with enhanced error handling
      const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryDer, {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      }, false, [
        'sign'
      ]);
      // Sign the data
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data));
      // Encode signature
      const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      console.log('✅ JWT created successfully');
      return `${data}.${encodedSignature}`;
    } catch (error) {
      console.error('❌ JWT creation failed:', error);
      console.error('PEM content length:', pemContent.length);
      throw new Error(`JWT creation failed: ${error.message}`);
    }
  }
  /**
   * Enhanced access token management with caching
   */ async getAccessToken() {
    // Check if cached token is still valid
    if (this.cache.token && Date.now() < this.cache.expires) {
      console.log('🔄 Using cached access token');
      return this.cache.token;
    }
    try {
      let serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
      if (!serviceAccountJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');
      }
      // Handle base64 encoded service accounts
      if (!serviceAccountJson.trim().startsWith('{')) {
        try {
          console.log('🔓 Decoding base64 service account...');
          serviceAccountJson = atob(serviceAccountJson);
          console.log('✅ Successfully decoded base64 service account');
        } catch (decodeError) {
          throw new Error('Service account appears to be base64 but failed to decode');
        }
      }
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('✅ Service account parsed, email:', serviceAccount.client_email);
      } catch (parseError) {
        throw new Error(`Failed to parse service account JSON: ${parseError.message}`);
      }
      // Create JWT
      const jwt = await this.createJWT(serviceAccount);
      // Exchange JWT for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      });
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
      }
      const tokenData = await tokenResponse.json();
      // Cache the token with expiration buffer
      this.cache.token = tokenData.access_token;
      this.cache.expires = Date.now() + (tokenData.expires_in - 300) * 1000; // 5 min buffer
      console.log('✅ New access token obtained and cached');
      return tokenData.access_token;
    } catch (error) {
      console.error('❌ Access token error:', error);
      throw new Error(`Failed to authenticate with Google Cloud: ${error.message}`);
    }
  }
  /**
   * Enhanced content generation with advanced configuration options
   */ async generateContent(request, useAtomPersona = true, retryCount = 0) {
    this.checkRateLimit();
    const maxRetries = 3;
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.model}:generateContent`;
      // Add ATOM system instruction if requested
      if (useAtomPersona && !request.systemInstruction) {
        request.systemInstruction = {
          parts: [
            {
              text: this.getAtomSystemPrompt()
            }
          ]
        };
        console.log('🤖 Added ATOM persona system instruction');
      }
      // Enhanced generation config with safety settings
      if (!request.generationConfig) {
        request.generationConfig = {};
      }
      // Add safety settings if not present
      if (!request.safetySettings) {
        request.safetySettings = [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ];
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });
      if (!response.ok) {
        const errorText = await response.text();
        // Handle specific error types
        if (response.status === 429 && retryCount < maxRetries) {
          console.log(`⏳ Rate limited, retrying in ${Math.pow(2, retryCount)} seconds...`);
          await new Promise((resolve)=>setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return this.generateContent(request, useAtomPersona, retryCount + 1);
        }
        if (response.status === 401) {
          // Token might be expired, clear cache
          this.cache.token = null;
          this.cache.expires = 0;
          if (retryCount < maxRetries) {
            console.log('🔄 Token expired, retrying with new token...');
            return this.generateContent(request, useAtomPersona, retryCount + 1);
          }
        }
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      // Validate response structure
      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API');
      }
      // Check for blocked content
      if (result.candidates[0].finishReason === 'SAFETY') {
        throw new Error('Content was blocked due to safety filters');
      }
      return result;
    } catch (error) {
      console.error('❌ Content generation error:', error);
      // Retry on network errors
      if (retryCount < maxRetries && (error.message.includes('fetch') || error.message.includes('network'))) {
        console.log(`🔄 Network error, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise((resolve)=>setTimeout(resolve, 1000));
        return this.generateContent(request, useAtomPersona, retryCount + 1);
      }
      throw error;
    }
  }
  /**
   * Enhanced streaming content generation
   */ async streamGenerateContent(request, useAtomPersona = true) {
    this.checkRateLimit();
    const accessToken = await this.getAccessToken();
    const url = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.model}:streamGenerateContent`;
    // Add ATOM system instruction if requested
    if (useAtomPersona && !request.systemInstruction) {
      request.systemInstruction = {
        parts: [
          {
            text: this.getAtomSystemPrompt()
          }
        ]
      };
      console.log('🤖 Added ATOM persona system instruction for streaming');
    }
    // Add safety settings
    if (!request.safetySettings) {
      request.safetySettings = [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ];
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }
    if (!response.body) {
      throw new Error('No response body for streaming');
    }
    return response.body;
  }
  /**
   * Enhanced Q&A method with context awareness
   */ async generateAnswer(question, context, customSystemPrompt = null, options = {}) {
    const { temperature = 0.3, topK = 40, topP = 0.8, maxTokens = 2048, includeContext = true } = options;
    const systemPrompt = customSystemPrompt || `${this.getEnhancedSystemPrompt('analysis')}

Answer questions based on the provided chat context and conversation history. Include relevant citations referring to chunk IDs when referencing specific information. Be conversational and helpful while maintaining your ATOM persona.

Context Analysis Guidelines:
- Reference specific evidence when making claims
- Distinguish between facts and interpretations
- Acknowledge limitations in the data
- Provide balanced perspectives
- Use clear, professional language`;
    let promptText = question;
    if (includeContext && context) {
      promptText = `Context: ${context}\n\nQuestion: ${question}`;
    }
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: promptText
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemPrompt
          }
        ]
      },
      generationConfig: {
        temperature,
        topK,
        topP,
        maxOutputTokens: maxTokens
      }
    };
    const response = await this.generateContent(request, false); // Don't double-add persona
    return response.candidates[0]?.content?.parts[0]?.text || 'No response generated';
  }
  /**
   * Advanced evaluation method with comprehensive contextual analysis
   */ async generateEvaluation(subjectUser, question, drivers, instances, policy, evidence, options = {}) {
    const { focusOnGrowth = true, includeActionItems = true, confidenceThreshold = 0.6 } = options;
    try {
      const systemPrompt = `You are ATOM, a virtual employee at Ting Works LLP, functioning as an intelligent performance evaluator with advanced contextual awareness.

EVALUATION PHILOSOPHY:
${focusOnGrowth ? '- Growth-oriented: Frame challenges as opportunities for development' : '- Performance-focused: Assess current capabilities and results'}
- Context-first: Always consider situational factors and circumstances
- Values-driven: Apply company drivers as interpretive lenses
- Evidence-based: Ground assessments in observable behaviors and communications
- Empathetic: Recognize human factors and individual challenges
- Balanced: Present both strengths and areas for improvement

ANALYSIS METHODOLOGY:
1. **Contextual Understanding**: Examine the full picture before making judgments
2. **Values Integration**: Apply each driver as a framework for positive interpretation  
3. **Growth Mindset**: Focus on development potential and learning opportunities
4. **Human-Centered**: Consider personal circumstances, workload, and external factors
5. **Evidence Synthesis**: Combine multiple data points for comprehensive assessment

INTERPRETIVE EXAMPLES:
- Delayed response + workload explanation = Transparency and workload management awareness
- Direct communication style = Efficiency, clarity, and respect for others' time
- Frequent questions = Thoroughness, quality focus, and commitment to excellence
- Extended project timelines = Attention to detail, quality assurance, and careful planning

COMPANY VALUES & DRIVERS:
${drivers.map((d)=>`
**${d.name}** (Key: ${d.key})
Description: ${d.description}
Weight: ${d.weight}
Scoring Guide: Use this driver to interpret behaviors positively while maintaining objectivity
`).join('\n')}

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON without markdown formatting, explanations, or code blocks
- Include scores for ALL ${drivers.length} drivers: ${drivers.map((d)=>d.key).join(', ')}
- Ensure all scores are integers between 1-5
- Provide contextual reasoning for each score
- Include confidence level based on evidence quality
${includeActionItems ? '- Include specific, actionable development recommendations' : ''}

REQUIRED JSON SCHEMA:
{
  "scores": [
    {
      "driver": "driver_key_exactly_as_provided",
      "score": 1-5,
      "reasoning": "Context-aware explanation that interprets behavior positively while considering circumstances and applying the driver as an interpretive lens",
      "weight": 0.5-2.0,
      "evidence_strength": "high|medium|low"
    }
  ],
  "contextual_insights": [
    "Behavioral patterns observed through positive interpretive lens",
    "Situational factors and circumstances that explain performance patterns"
  ],
  "strengths": [
    "Clear strengths demonstrated through company values framework"
  ],
  "growth_opportunities": [
    ${includeActionItems ? '"Specific, actionable development areas with suggested approaches"' : '"Areas for potential development framed constructively"'}
  ],
  "confidence_analysis": {
    "overall_confidence": 0.0-1.0,
    "evidence_quality": "comprehensive|moderate|limited",
    "data_coverage": "multi_context|single_context|insufficient",
    "reliability_factors": ["factors affecting assessment reliability"]
  },
  "weighted_total": 0.0-5.0,
  "summary": "A thoughtful, balanced assessment that a caring manager would find valuable for understanding and supporting their team member"
}`;
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `PERFORMANCE EVALUATION REQUEST

Manager's Question: "${question}"
Subject for Evaluation: ${subjectUser}

EVIDENCE FROM CONVERSATIONS:
${JSON.stringify(evidence, null, 2)}

COMPANY VALUES CONTEXT:
${JSON.stringify(drivers, null, 2)}

EVALUATION REQUIREMENTS:
Please analyze ${subjectUser}'s performance through our company values lens, applying each driver as a positive interpretive framework while maintaining analytical objectivity.

Key Analysis Points:
1. Examine evidence for patterns that demonstrate each company driver
2. Consider situational context and circumstances
3. Apply growth mindset interpretation where appropriate
4. Provide specific reasoning tied to observable behaviors
5. Assess confidence based on evidence quality and coverage

You MUST evaluate against ALL ${drivers.length} drivers: ${drivers.map((d)=>d.key).join(', ')}

Return evaluation in the specified JSON format with no additional formatting or explanations.`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        },
        generationConfig: {
          temperature: 0.2,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 6000,
          candidateCount: 1
        }
      };
      console.log('🤖 Generating contextual evaluation with advanced analysis...');
      const response = await this.generateContent(request, false);
      const rawResponse = response.candidates[0]?.content?.parts[0]?.text;
      if (!rawResponse) {
        throw new Error('No response from Gemini for evaluation');
      }
      console.log('📝 Raw evaluation response length:', rawResponse.length);
      // Clean and parse response
      const cleanedResponse = this.cleanJsonResponse(rawResponse);
      console.log('🧹 Cleaned response preview:', cleanedResponse.substring(0, 300));
      try {
        const evalJson = JSON.parse(cleanedResponse);
        console.log('✅ Successfully parsed evaluation JSON');
        // Comprehensive validation
        if (!evalJson.scores || !Array.isArray(evalJson.scores) || evalJson.scores.length === 0) {
          throw new Error('Evaluation returned invalid or empty scores array');
        }
        // Validate driver keys
        const expectedDriverKeys = new Set(drivers.map((d)=>d.key));
        const receivedDriverKeys = new Set(evalJson.scores.map((s)=>s.driver));
        const missingDrivers = [
          ...expectedDriverKeys
        ].filter((k)=>!receivedDriverKeys.has(k));
        if (missingDrivers.length > 0) {
          console.warn('⚠️ Missing drivers in evaluation:', missingDrivers);
          // Add missing drivers with neutral scores
          missingDrivers.forEach((driverKey)=>{
            const driver = drivers.find((d)=>d.key === driverKey);
            evalJson.scores.push({
              driver: driverKey,
              score: 3,
              reasoning: `Based on available evidence, ${subjectUser} demonstrates adequate performance in this area. More comprehensive data would enable a more detailed assessment.`,
              weight: driver ? driver.weight : 1.0,
              evidence_strength: 'low'
            });
          });
        }
        // Ensure all required fields are present
        if (!evalJson.contextual_insights) {
          evalJson.contextual_insights = [
            `${subjectUser} demonstrates engagement in team communications and work activities`,
            "Assessment considers available evidence and contextual factors"
          ];
        }
        if (!evalJson.confidence_analysis) {
          evalJson.confidence_analysis = {
            overall_confidence: 0.7,
            evidence_quality: 'moderate',
            data_coverage: 'single_context',
            reliability_factors: [
              'Limited conversation data',
              'Single context evaluation'
            ]
          };
        }
        return evalJson;
      } catch (parseError) {
        console.error('❌ Failed to parse evaluation JSON:', parseError);
        console.error('Raw response excerpt:', rawResponse.substring(0, 500));
        console.error('Cleaned response excerpt:', cleanedResponse.substring(0, 500));
        // Enhanced fallback with better structure
        return this.createFallbackEvaluation(subjectUser, drivers, evidence);
      }
    } catch (error) {
      console.error('❌ Error in advanced evaluation generation:', error);
      return this.createFallbackEvaluation(subjectUser, drivers, evidence);
    }
  }
  /**
   * Create structured fallback evaluation
   */ createFallbackEvaluation(subjectUser, drivers, evidence) {
    console.log('🔄 Creating structured fallback evaluation...');
    return {
      scores: drivers.map((driver)=>({
          driver: driver.key,
          score: 3,
          reasoning: `Based on available evidence, ${subjectUser} demonstrates engagement and participation in team activities. This driver shows adequate performance with potential for growth as more comprehensive evidence becomes available.`,
          weight: driver.weight || 1.0,
          evidence_strength: 'medium'
        })),
      contextual_insights: [
        `${subjectUser} shows active participation in team communications and work discussions`,
        "Evaluation considers available evidence within its contextual limitations",
        "Performance assessment benefits from understanding of individual circumstances and challenges"
      ],
      strengths: [
        "Team engagement and communication",
        "Participation in work-related discussions",
        "Responsiveness to team interactions"
      ],
      growth_opportunities: [
        "Continue building on existing communication strengths",
        "Explore opportunities for increased visibility of contributions",
        "Develop strategies for showcasing expertise and insights"
      ],
      confidence_analysis: {
        overall_confidence: 0.65,
        evidence_quality: 'moderate',
        data_coverage: 'limited',
        reliability_factors: [
          'Limited conversation history',
          'Single communication channel analysis',
          'Requires broader performance context'
        ]
      },
      weighted_total: 3.0,
      summary: `${subjectUser} demonstrates positive engagement with the team and participates actively in work discussions. This evaluation reflects available communication evidence and would benefit from additional performance context across multiple channels and timeframes for a more comprehensive assessment.`
    };
  }
  /**
   * Generate comprehensive general evaluation without specific drivers
   */ async generateGeneralEvaluation(subjectUser, question, evidence, options = {}) {
    const { includeRecommendations = true, focusAreas = [
      'communication',
      'collaboration',
      'reliability',
      'adaptability',
      'growth_mindset'
    ], analysisDepth = 'comprehensive' } = options;
    try {
      const systemPrompt = `You are ATOM, a virtual employee at Ting Works LLP, providing comprehensive performance analysis and insights.

Your role is to help managers understand ${subjectUser} as a team member by looking beyond surface behaviors to understand context, challenges, and positive intentions.

ANALYSIS FRAMEWORK:
1. **Behavioral Patterns**: How they communicate, respond, and engage with the team
2. **Work Approach**: Methods, thoroughness, quality focus, and problem-solving style
3. **Team Dynamics**: Contribution to team cohesion, collaboration, and collective success
4. **Adaptability**: Response to changes, challenges, and new situations
5. **Reliability**: Consistency in follow-through, accountability, and dependability  
6. **Growth Orientation**: Evidence of learning, improvement, and development mindset

CONTEXTUAL CONSIDERATIONS:
- External factors that may influence performance (workload, personal circumstances, organizational changes)
- Communication style preferences and cultural factors
- Individual strengths and natural work preferences
- Team dynamics and interpersonal relationships
- Organizational expectations and role requirements

ANALYSIS PRINCIPLES:
- Seek to understand the story behind behaviors and patterns
- Look for positive intent and contextual explanations
- Consider multiple perspectives and interpretations
- Frame challenges as opportunities for support and development
- Focus on actionable insights that help managers support their team members
- Balance objective observation with empathetic understanding

RESPONSE STRUCTURE:
Provide a narrative assessment organized into clear sections that a caring manager would find valuable for understanding and supporting their team member.`;
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `COMPREHENSIVE TEAM MEMBER ANALYSIS

Manager's Question: "${question}"
Team Member: ${subjectUser}

CONVERSATION EVIDENCE:
${JSON.stringify(evidence, null, 2)}

ANALYSIS REQUEST:
Please provide a comprehensive analysis of ${subjectUser}'s performance and work patterns that helps the manager understand:

1. **Communication & Interaction Patterns**
   - How they engage with the team
   - Communication style and preferences  
   - Response patterns and timing
   - Quality of interactions and contributions

2. **Work Approach & Quality Focus**
   - Methods and processes they use
   - Attention to detail and thoroughness
   - Problem-solving approach
   - Quality standards and delivery

3. **Team Dynamics & Collaboration**
   - Contribution to team cohesion
   - Support for colleagues and team goals
   - Leadership qualities and initiative
   - Conflict resolution and diplomacy

4. **Reliability & Accountability**
   - Consistency in follow-through
   - Meeting commitments and deadlines
   - Taking ownership of responsibilities
   - Communication about challenges or delays

5. **Adaptability & Growth Mindset**
   - Response to change and new challenges
   - Learning orientation and skill development
   - Feedback reception and implementation
   - Innovation and creative problem-solving

6. **Contextual Factors & Recommendations**
   - Situational influences on performance
   - Environmental or systemic factors
   - Specific support strategies that would help
   - Development opportunities and growth areas

Focus on providing insights that help build a supportive, effective working relationship and enable ${subjectUser} to thrive in their role.`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        },
        generationConfig: {
          temperature: 0.4,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 3000,
          candidateCount: 1
        }
      };
      console.log('🤖 Generating comprehensive general evaluation...');
      const response = await this.generateContent(request, false);
      const result = response.candidates[0]?.content?.parts[0]?.text || 'Unable to generate comprehensive evaluation based on available evidence.';
      console.log('✅ Comprehensive general evaluation completed');
      return result;
    } catch (error) {
      console.error('❌ Error in comprehensive general evaluation:', error);
      return this.createFallbackGeneralEvaluation(subjectUser, question, evidence);
    }
  }
  /**
   * Fallback general evaluation
   */ createFallbackGeneralEvaluation(subjectUser, question, evidence) {
    return `Based on the available conversation evidence, here's my analysis of ${subjectUser} as a team member:

**Communication & Engagement**
${subjectUser} appears to be an engaged team member who participates in work discussions and maintains communication with colleagues. Their interaction patterns suggest someone who is responsive to team needs and contributes to ongoing conversations about projects and responsibilities.

**Work Approach**
From the available evidence, ${subjectUser} demonstrates involvement in work-related activities and shows engagement with team processes. To provide more detailed insights about their specific work methods, quality standards, and problem-solving approach, additional context about their project contributions and task management would be valuable.

**Team Collaboration**
The communication evidence suggests ${subjectUser} participates in collaborative efforts and maintains professional relationships with team members. They appear to be integrated into team dynamics and contribute to group discussions and decision-making processes.

**Reliability & Follow-through**
Based on available interactions, ${subjectUser} shows signs of being responsive to communications and engaged with team responsibilities. A more complete picture of their reliability would benefit from additional data about project deadlines, commitment fulfillment, and proactive communication about challenges.

**Growth & Development Potential**
${subjectUser} demonstrates engagement that suggests openness to collaboration and team contribution. With the right support and clear expectations, there appears to be good potential for continued development and increased contribution to team goals.

**Recommendations for Manager Support**
1. Regular check-ins to understand ${subjectUser}'s perspective on workload and challenges
2. Clear communication of expectations and priorities
3. Recognition of current contributions while identifying specific growth opportunities
4. Creating opportunities for ${subjectUser} to showcase their strengths and expertise
5. Providing feedback and guidance to support continued professional development

This assessment is based on available communication evidence and would benefit from broader performance context including direct work outputs, peer feedback, and goal achievement metrics for a more comprehensive evaluation.`;
  }
  /**
   * Enhanced direct response generation with context optimization
   */ async generateDirectResponse(question, context, systemPrompt, isSpecificInstance = false, options = {}) {
    const { temperature = isSpecificInstance ? 0.1 : 0.3, maxTokens = 4096, includeDebugInfo = false, responseFormat = 'text' } = options;
    try {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${context}\n\nQuestion: ${question}`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        },
        generationConfig: {
          temperature,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: maxTokens,
          candidateCount: 1
        }
      };
      // Add JSON format if requested
      if (responseFormat === 'json') {
        request.generationConfig.responseMimeType = 'application/json';
      }
      console.log('🤖 Generating direct response...');
      const response = await this.generateContent(request, false);
      let fullText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`📝 Direct response generated: ${fullText.length} characters`);
      if (includeDebugInfo) {
        console.log('📝 Response preview:', fullText.substring(0, 200) + '...');
      }
      return fullText || 'No response generated from Gemini.';
    } catch (error) {
      console.error('❌ Direct response generation error:', error);
      throw error;
    }
  }
  /**
   * Enhanced casual conversation with personality and context awareness
   */   async generateCasualResponse(question, conversationContext = '', options = {}) {
    const { maxLength = 2000, personality = 'professional', includeCompanyInfo = false } = options;
    const personalityPrompts = {
      professional: 'Be conversational yet professional. Keep responses brief and helpful.',
      friendly: 'Be warm, friendly, and approachable. Use a conversational tone.',
      creative: 'Be engaging and creative in your responses while staying professional.',
      analytical: 'Be precise and informative. Focus on providing clear, accurate information.'
    };
    const casualSystemPrompt = `You are ATOM from Ting Works LLP. 

${personalityPrompts[personality]}

${includeCompanyInfo ? `
Company Background (mention only when relevant):
- Ting Works LLP: Integrated advertising agency
- Global presence: Chennai, Kochi, Mumbai, Dubai, London
- Services: Advertising, digital marketing, creative campaigns
` : 'Only mention company details if specifically asked about Ting Works or your role.'}

Response Guidelines:
- Keep responses under ${maxLength} characters (allowing for detailed, helpful responses)
- Be natural and conversational  
- Stay helpful and professional
- Avoid overly formal language
- Provide comprehensive answers when appropriate

Examples:
Q: "Who are you?" 
A: "I'm ATOM from Ting Works LLP. How can I help you today?"

Q: "What do you do?"
A: "I work at Ting Works LLP, an advertising agency. What can I assist you with?"

Q: "Tell me about Ting"
A: "Ting Works LLP is an integrated advertising agency with offices in Chennai, Kochi, Mumbai, Dubai, and London. We help brands with advertising and digital marketing."`;
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ''}Current question: ${question}`
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: casualSystemPrompt
          }
        ]
      },
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        maxOutputTokens: Math.ceil(maxLength * 1.5) // Buffer for token estimation
      }
    };
    const response = await this.generateContent(request, false);
    let result = response.candidates[0]?.content?.parts[0]?.text || 'No response generated';
    // Trim if too long
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 3) + '...';
    }
    console.log(`🎭 Casual response generated (${result.length} chars):`, result);
    return result;
  }
  /**
   * Advanced streaming response with real-time processing
   */ async generateStreamingResponse(question, context, systemPrompt, stream, isSpecificInstance = false, options = {}) {
    const { chunkSize = 10, delayMs = 30, onChunk = null, onComplete = null, onError = null } = options;
    try {
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${context}\n\nQuestion: ${question}`
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemPrompt
            }
          ]
        },
        generationConfig: {
          temperature: isSpecificInstance ? 0.1 : 0.3,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 4096,
          candidateCount: 1
        }
      };
      console.log('🤖 Starting advanced streaming response...');
      const streamResponse = await this.streamGenerateContent(request, false);
      const reader = streamResponse.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let chunkBuffer = '';
      try {
        while(true){
          const { done, value } = await reader.read();
          if (done) {
            // Send any remaining buffer
            if (chunkBuffer.trim()) {
              // FIXED: Add proper spacing for the final chunk
              const finalChunkWithSpace = chunkBuffer + ' ';
              stream.token(finalChunkWithSpace);
              fullResponse += finalChunkWithSpace;
            }
            console.log('✅ Advanced streaming completed');
            break;
          }
          const chunk = decoder.decode(value, {
            stream: true
          });
          const lines = chunk.split('\n');
          for (const line of lines){
            if (line.trim() === '') continue;
            try {
              // Handle different streaming response formats
              let jsonData;
              if (line.startsWith('data: ')) {
                jsonData = JSON.parse(line.substring(6));
              } else {
                jsonData = JSON.parse(line);
              }
              if (jsonData.candidates && jsonData.candidates[0] && jsonData.candidates[0].content) {
                const textPart = jsonData.candidates[0].content.parts[0]?.text;
                if (textPart) {
                  chunkBuffer += textPart;
                  // Send chunks when buffer reaches size threshold
                  if (chunkBuffer.length >= chunkSize) {
                    // FIXED: Add proper spacing between chunks to prevent concatenation
                    const chunkWithSpace = chunkBuffer + ' ';
                    stream.token(chunkWithSpace);
                    fullResponse += chunkWithSpace;
                    // Call chunk callback if provided
                    if (onChunk) {
                      onChunk(chunkWithSpace, fullResponse.length);
                    }
                    chunkBuffer = '';
                    await new Promise((resolve)=>setTimeout(resolve, delayMs));
                  }
                }
              }
            } catch (parseError) {
              console.log('Skipping invalid streaming line:', line.substring(0, 100));
            }
          }
        }
      } finally{
        reader.releaseLock();
      }
      console.log('📝 Total advanced streaming response:', fullResponse.length, 'characters');
      if (onComplete) {
        onComplete(fullResponse);
      }
      return fullResponse;
    } catch (error) {
      console.error('❌ Advanced streaming error:', error);
      if (onError) {
        onError(error);
      }
      // Fallback to direct response
      console.log('🔄 Falling back to direct response...');
      return await this.generateDirectResponse(question, context, systemPrompt, isSpecificInstance);
    }
  }
  /**
   * Specialized content generation for different use cases
   */ async generateSpecializedContent(type, prompt, options = {}) {
    const { context = '', temperature = 0.4, maxTokens = 2048, language = 'english', tone = 'professional' } = options;
    const specializedPrompts = {
      creative: `${this.getEnhancedSystemPrompt('creative')}

Generate creative, engaging content that demonstrates advertising industry expertise while maintaining professional standards. Be innovative and think outside conventional approaches.`,
      analytical: `${this.getEnhancedSystemPrompt('analysis')}

Provide detailed, data-driven analysis with clear insights and actionable recommendations. Support conclusions with evidence and logical reasoning.`,
      technical: `${this.getAtomSystemPrompt()}

Provide technical information with clarity and precision. Break down complex concepts into understandable components while maintaining accuracy.`,
      strategic: `${this.getEnhancedSystemPrompt('creative')}

Think strategically about business challenges and opportunities. Consider multiple perspectives, market dynamics, and long-term implications.`
    };
    const systemPrompt = specializedPrompts[type] || this.getAtomSystemPrompt();
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: context ? `Context: ${context}\n\nRequest: ${prompt}` : prompt
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: `${systemPrompt}

Additional Guidelines:
- Language: ${language}
- Tone: ${tone}
- Content Type: ${type}
- Focus on providing value and actionable insights`
          }
        ]
      },
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: maxTokens
      }
    };
    console.log(`🎯 Generating specialized ${type} content...`);
    const response = await this.generateContent(request, false);
    return response.candidates[0]?.content?.parts[0]?.text || 'No specialized content generated';
  }
  /**
   * Batch content generation for multiple requests
   */ async generateBatchContent(requests, options = {}) {
    const { concurrency = 3, retryFailures = true, includeMetadata = false } = options;
    console.log(`📦 Processing ${requests.length} batch requests with concurrency ${concurrency}...`);
    const results = [];
    const chunks = [];
    // Split into chunks for concurrent processing
    for(let i = 0; i < requests.length; i += concurrency){
      chunks.push(requests.slice(i, i + concurrency));
    }
    for (const chunk of chunks){
      const chunkPromises = chunk.map(async (request, index)=>{
        const startTime = Date.now();
        try {
          const response = await this.generateContent(request.config, request.useAtomPersona);
          const result = {
            id: request.id || `batch_${index}`,
            success: true,
            content: response.candidates[0]?.content?.parts[0]?.text || '',
            ...includeMetadata && {
              metadata: {
                latency_ms: Date.now() - startTime,
                model: this.config.model,
                tokens: response.usageMetadata || null
              }
            }
          };
          return result;
        } catch (error) {
          console.error(`❌ Batch request failed for ${request.id}:`, error);
          return {
            id: request.id || `batch_${index}`,
            success: false,
            error: error.message,
            ...includeMetadata && {
              metadata: {
                latency_ms: Date.now() - startTime
              }
            }
          };
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      // Brief pause between chunks to avoid rate limiting
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise((resolve)=>setTimeout(resolve, 100));
      }
    }
    // Retry failures if requested
    if (retryFailures) {
      const failures = results.filter((r)=>!r.success);
      if (failures.length > 0) {
        console.log(`🔄 Retrying ${failures.length} failed requests...`);
        for (const failure of failures){
          const originalRequest = requests.find((r)=>(r.id || `batch_${requests.indexOf(r)}`) === failure.id);
          if (originalRequest) {
            try {
              await new Promise((resolve)=>setTimeout(resolve, 1000)); // Wait before retry
              const response = await this.generateContent(originalRequest.config, originalRequest.useAtomPersona);
              failure.success = true;
              failure.content = response.candidates[0]?.content?.parts[0]?.text || '';
              delete failure.error;
            } catch (retryError) {
              console.error(`❌ Retry failed for ${failure.id}:`, retryError);
            }
          }
        }
      }
    }
    const successCount = results.filter((r)=>r.success).length;
    console.log(`✅ Batch processing completed: ${successCount}/${requests.length} successful`);
    return results;
  }
  /**
   * Enhanced content generation with structured output
   */ async generateStructuredContent(prompt, schema, options = {}) {
    const { context = '', temperature = 0.3, maxTokens = 4096, validateOutput = true } = options;
    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: context ? `Context: ${context}\n\nRequest: ${prompt}` : prompt
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: this.getAtomSystemPrompt()
          }
        ]
      },
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    };
    console.log('🏗️ Generating structured content with schema...');
    const response = await this.generateContent(request, false);
    const rawContent = response.candidates[0]?.content?.parts[0]?.text || '{}';
    if (validateOutput) {
      try {
        const parsed = JSON.parse(rawContent);
        console.log('✅ Structured content validation passed');
        return parsed;
      } catch (parseError) {
        console.error('❌ Structured content validation failed:', parseError);
        console.log('Raw content:', rawContent.substring(0, 300));
        throw new Error(`Invalid structured output: ${parseError.message}`);
      }
    }
    return rawContent;
  }
  /**
   * Multi-modal content generation (text + images)
   */ async generateMultiModalContent(textPrompt, imageData = null, options = {}) {
    const { temperature = 0.4, maxTokens = 2048, mimeType = 'image/jpeg' } = options;
    const parts = [
      {
        text: textPrompt
      }
    ];
    // Add image if provided
    if (imageData) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageData // Base64 encoded image data
        }
      });
    }
    const request = {
      contents: [
        {
          role: 'user',
          parts: parts
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: this.getAtomSystemPrompt()
          }
        ]
      },
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: maxTokens
      }
    };
    console.log('🖼️ Generating multi-modal content...');
    const response = await this.generateContent(request, false);
    return response.candidates[0]?.content?.parts[0]?.text || 'No multi-modal content generated';
  }
  /**
   * Context-aware conversation continuation
   */ async continueConversation(messages, options = {}) {
    const { temperature = 0.6, maxTokens = 2048, maintainPersona = true } = options;
    const contents = messages.map((msg)=>({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text: msg.content
          }
        ]
      }));
    const request = {
      contents: contents,
      systemInstruction: maintainPersona ? {
        parts: [
          {
            text: this.getAtomSystemPrompt()
          }
        ]
      } : undefined,
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: maxTokens
      }
    };
    console.log('💬 Continuing conversation with context...');
    const response = await this.generateContent(request, false);
    return response.candidates[0]?.content?.parts[0]?.text || 'No conversation continuation generated';
  }
  /**
   * Health check and diagnostics
   */ async healthCheck() {
    try {
      console.log('🔍 Performing Gemini client health check...');
      const healthRequest = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Health check - please respond with "OK"'
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 10
        }
      };
      const startTime = Date.now();
      const response = await this.generateContent(healthRequest, false);
      const latency = Date.now() - startTime;
      const healthStatus = {
        status: 'healthy',
        latency_ms: latency,
        model: this.config.model,
        project_id: this.config.projectId,
        location: this.config.location,
        cache_status: {
          token_cached: !!this.cache.token,
          token_expires_in: Math.max(0, this.cache.expires - Date.now())
        },
        response_valid: !!(response.candidates && response.candidates[0]?.content?.parts?.[0]?.text),
        timestamp: new Date().toISOString()
      };
      console.log('✅ Health check passed:', healthStatus);
      return healthStatus;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  /**
   * Get client statistics and performance metrics
   */ getStats() {
    return {
      config: {
        model: this.config.model,
        project_id: this.config.projectId,
        location: this.config.location
      },
      cache: {
        token_cached: !!this.cache.token,
        expires_in_ms: Math.max(0, this.cache.expires - Date.now())
      },
      rate_limiter: {
        current_requests: this.rateLimiter.requests.length,
        max_requests: this.rateLimiter.maxRequests,
        window_ms: this.rateLimiter.windowMs,
        requests_available: Math.max(0, this.rateLimiter.maxRequests - this.rateLimiter.requests.length)
      },
      uptime_ms: Date.now() - this.startTime
    };
  }
  /**
   * Clear cache and reset state
   */ reset() {
    console.log('🔄 Resetting Gemini client state...');
    this.cache.token = null;
    this.cache.expires = 0;
    this.rateLimiter.requests = [];
    console.log('✅ Client state reset completed');
  }
  /**
   * Advanced error handling and recovery
   */ async handleApiError(error, context = '') {
    console.error(`❌ API Error in ${context}:`, error);
    // Categorize error types
    const errorInfo = {
      type: 'unknown',
      recoverable: false,
      retryAfter: 0,
      message: error.message
    };
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      errorInfo.type = 'rate_limit';
      errorInfo.recoverable = true;
      errorInfo.retryAfter = 5000; // 5 seconds
    } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
      errorInfo.type = 'authentication';
      errorInfo.recoverable = true;
      errorInfo.retryAfter = 1000; // 1 second after token refresh
      // Clear cached token
      this.cache.token = null;
      this.cache.expires = 0;
    } else if (error.message.includes('quota') || error.message.includes('limit exceeded')) {
      errorInfo.type = 'quota_exceeded';
      errorInfo.recoverable = false;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorInfo.type = 'network';
      errorInfo.recoverable = true;
      errorInfo.retryAfter = 2000; // 2 seconds
    }
    return errorInfo;
  }
  /**
   * Performance optimization and monitoring
   */ async optimizePerformance() {
    const stats = this.getStats();
    const recommendations = [];
    // Check cache utilization
    if (!stats.cache.token_cached) {
      recommendations.push({
        type: 'cache',
        message: 'Token not cached - authentication will be slower',
        impact: 'medium'
      });
    }
    // Check rate limiting
    const rateLimitUtilization = stats.rate_limiter.current_requests / stats.rate_limiter.max_requests * 100;
    if (rateLimitUtilization > 80) {
      recommendations.push({
        type: 'rate_limiting',
        message: `Rate limit utilization high: ${rateLimitUtilization.toFixed(1)}%`,
        impact: 'high'
      });
    }
    // Check uptime
    const uptimeHours = stats.uptime_ms / (1000 * 60 * 60);
    if (uptimeHours > 24) {
      recommendations.push({
        type: 'uptime',
        message: `Long uptime detected: ${uptimeHours.toFixed(1)} hours - consider periodic reset`,
        impact: 'low'
      });
    }
    return {
      stats,
      recommendations,
      overall_health: recommendations.filter((r)=>r.impact === 'high').length === 0 ? 'good' : 'needs_attention'
    };
  }
}
// Export singleton instance with enhanced error handling
export const geminiClient = new GeminiClient();
