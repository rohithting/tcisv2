-- Migration to insert Core Values and Key Drivers data
-- This will populate the drivers, driver_behaviors, and driver_instances tables

-- First, ensure we have the required user ID for created_by fields
-- Using the existing user ID from the system
DO $$
DECLARE
    default_user_id uuid := 'bcddd0fc-7ab7-4550-887e-29e007237d8d';
BEGIN

-- 1. INSERT CORE VALUES (DRIVERS)
INSERT INTO drivers (name, description, criteria, weight, key, negative_indicators, created_by, is_active) VALUES
-- Core Values
('Empathy', 'Seeing through others'' eyes, acting with heart.', 'The ability to understand, respect, and adapt to the perspectives, emotions, and challenges of colleagues, clients, and partners in order to build stronger, more human connections.', 1.0, 'empathy', ARRAY['dismissive', 'unsympathetic', 'insensitive', 'uncompassionate'], default_user_id, true),

('Integrity', 'Doing what''s right, even when unseen.', 'Upholding honesty, fairness, and responsibility in every action — ensuring consistency between words, decisions, and outcomes, even when faced with difficult choices.', 1.0, 'integrity', ARRAY['dishonest', 'unfair', 'irresponsible', 'unethical'], default_user_id, true),

('Ownership', 'If it''s ours, it''s mine to solve.', 'Taking charge of commitments with a founder''s mindset — seeing projects through end-to-end, stepping in where needed, and ensuring outcomes align with ting''s standards, regardless of challenges.', 1.0, 'ownership', ARRAY['defensive', 'blame-shifting', 'unreliable', 'unaccountable'], default_user_id, true),

('Learning & Growth', 'Evolving every day, together.', 'A commitment to continuously expanding knowledge, experimenting with new tools and approaches, and using those learnings to elevate both personal performance and the team''s collective strength.', 1.0, 'learning_growth', ARRAY['resistant', 'stagnant', 'unwilling', 'closed-minded'], default_user_id, true);

-- 2. INSERT KEY DRIVERS (DRIVERS)
INSERT INTO drivers (name, description, criteria, weight, key, negative_indicators, created_by, is_active) VALUES
-- Key Drivers
('One-Ting', 'Many hands, one heartbeat.', 'Fostering unity and collective strength by ensuring cross-team collaboration, knowledge-sharing, and celebrating wins as one ting family.', 1.0, 'one_ting', ARRAY['siloed', 'selfish', 'disconnected', 'divisive'], default_user_id, true),

('Zoom In – Zoom Out', 'Detail in focus, vision in sight.', 'Balancing attention between micro-level execution and macro-level vision — being able to dive deep into details when required, while also stepping back to align with ting''s larger goals and long-term impact.', 1.0, 'zoom_in_zoom_out', ARRAY['tunnel-visioned', 'short-sighted', 'unbalanced', 'narrow-minded'], default_user_id, true),

('Infinite Game', 'Playing beyond today, building for tomorrow.', 'Playing for the long run — prioritising enduring trust, relationships, and sustainable growth over short-term gains or shortcuts.', 1.0, 'infinite_game', ARRAY['short-term', 'opportunistic', 'compromising', 'untrustworthy'], default_user_id, true),

('Servant Leadership', 'Leading by empowering others.', 'Leading by serving — putting the team''s growth, wellbeing, and success first, while enabling them to thrive and take ownership.', 1.0, 'servant_leadership', ARRAY['authoritarian', 'self-serving', 'controlling', 'disempowering'], default_user_id, true);

-- 3. INSERT DRIVER BEHAVIORS (POSITIVE AND NEGATIVE EXAMPLES)
INSERT INTO driver_behaviors (driver_id, behavior_text, is_positive, example_text, positive_examples, negative_examples, created_at) VALUES
-- Empathy Behaviors
((SELECT id FROM drivers WHERE key = 'empathy'), 'Actively listens to colleagues'' challenges and adapts solutions to support them', true, 'Shows compassion in moments of stress', ARRAY['Actively listens to colleagues'' challenges and adapts solutions to support them', 'Anticipates client needs or sensitivities and adjusts communication style accordingly', 'Shows compassion in moments of stress', 'Recognizes unspoken concerns in team dynamics and works to resolve them', 'Avoids dismissing or trivializing others'' experiences, even when disagreeing'], ARRAY['Often disregards or dismisses others'' feelings', 'Creates friction by being insensitive', 'Prioritizes self-interest over relationships'], now()),

-- Integrity Behaviors  
((SELECT id FROM drivers WHERE key = 'integrity'), 'Communicates transparently with clients and teammates, avoiding misrepresentation', true, 'Takes responsibility for mistakes and works toward corrective action', ARRAY['Communicates transparently with clients and teammates, avoiding misrepresentation', 'Takes responsibility for mistakes and works toward corrective action instead of shifting blame', 'Stands firm on ting''s principles even when it risks losing opportunities', 'Ensures commitments to clients, teams, or partners are honored within agreed timelines and quality', 'Does not compromise ethical standards for short-term gains'], ARRAY['Often avoids accountability', 'Bends rules for convenience', 'Allows integrity to be compromised under pressure'], now()),

-- Ownership Behaviors
((SELECT id FROM drivers WHERE key = 'ownership'), 'Takes responsibility from briefing to delivery, ensuring no handoffs fall through the cracks', true, 'When faced with unforeseen hurdles, addresses them head-on and pushes for solutions', ARRAY['Takes responsibility from briefing to delivery, ensuring no handoffs fall through the cracks', 'When faced with unforeseen hurdles (tight deadlines, last-minute client changes), addresses them head-on and pushes for solutions', 'Owns mistakes openly, rectifies them swiftly, and ensures the client experience stays seamless', 'Holds themselves and peers to high standards, ensuring commitments aren''t just "done" but "done well"'], ARRAY['Reluctant to own outcomes', 'Shifts responsibility', 'Delivers incomplete work without accountability'], now()),

-- Learning & Growth Behaviors
((SELECT id FROM drivers WHERE key = 'learning_growth'), 'Takes initiative to learn new tools and applies them on live projects to improve efficiency and creativity', true, 'Goes beyond theory by experimenting with fresh approaches', ARRAY['Takes initiative to learn new tools like AI applications, Figma, or editing techniques and applies them on live projects to improve efficiency and creativity', 'Goes beyond theory by experimenting with fresh approaches', 'Regularly coaches or guides teammates—whether by introducing smarter workflows, teaching newly learned shortcuts, or sharing insights gained from external courses or industry exposure', 'Actively seeks feedback on work and uses it to refine outputs instead of defending past methods', 'Encourages peer-to-peer learning by making space for discussions, quick tutorials, or idea exchanges'], ARRAY['Resists new tools or skills', 'Avoids feedback', 'Continues relying only on past knowledge without contributing to collective learning'], now()),

-- One-Ting Behaviors
((SELECT id FROM drivers WHERE key = 'one_ting'), 'Actively collaborates with other teams to solve challenges instead of working in silos', true, 'Shares knowledge, best practices, or tools that make everyone''s work easier', ARRAY['Actively collaborates with other teams to solve challenges instead of working in silos', 'Shares knowledge, best practices, or tools that make everyone''s work easier', 'Acknowledges and celebrates team achievements, not just individual wins', 'Puts ting''s long-term reputation and success above short-term personal gains'], ARRAY['Works in silos', 'Hoards knowledge', 'Prioritizes self/individual team over ting'], now()),

-- Zoom In – Zoom Out Behaviors
((SELECT id FROM drivers WHERE key = 'zoom_in_zoom_out'), 'Switches seamlessly between detail-oriented problem solving and big-picture strategic thinking', true, 'Identifies gaps, errors, or risks early while keeping the broader campaign or client outcome in mind', ARRAY['Switches seamlessly between detail-oriented problem solving and big-picture strategic thinking', 'Identifies gaps, errors, or risks early while keeping the broader campaign or client outcome in mind', 'Makes decisions considering both immediate deliverables and long-term brand/agency reputation', 'Challenges teams to see beyond their current task and connect it to ting''s vision'], ARRAY['Struggles to shift perspectives', 'Leads to missed details or misalignment with the bigger strategy'], now()),

-- Infinite Game Behaviors
((SELECT id FROM drivers WHERE key = 'infinite_game'), 'Prioritises actions that strengthen long-term client partnerships rather than chasing one-off wins', true, 'Invests time in doing the right thing, even if it takes more effort now', ARRAY['Prioritises actions that strengthen long-term client partnerships rather than chasing one-off wins', 'Invests time in doing the right thing, even if it takes more effort now', 'Builds processes, relationships, and creative work that outlast immediate campaigns', 'Keeps ting''s reputation and credibility intact, even when pressured for shortcuts'], ARRAY['Operates with a short-term mindset', 'Disregards future implications on relationships, reputation, or growth'], now()),

-- Servant Leadership Behaviors
((SELECT id FROM drivers WHERE key = 'servant_leadership'), 'Provides mentorship and guidance that helps teammates grow in skill and confidence', true, 'Shields the team from unnecessary external pressures, while constructively managing client expectations', ARRAY['Provides mentorship and guidance that helps teammates grow in skill and confidence', 'Shields the team from unnecessary external pressures, while constructively managing client expectations', 'Prioritises the collective success of the team over personal recognition', 'Creates an environment where individuals feel safe to express ideas and take risks'], ARRAY['Operates from a self-serving or authoritative stance', 'Neglects the growth, wellbeing, or recognition of the team'], now());

-- 4. INSERT DRIVER INSTANCES (STORIES AND EXAMPLES)
INSERT INTO driver_instances (driver_id, title, narrative, takeaway, tags, created_at) VALUES
-- Empathy Instances
((SELECT id FROM drivers WHERE key = 'empathy'), 'Respecting Grief Over Celebration', 'In the lead-up to ting''s annual party, tragedy struck when a beloved tingster passed away suddenly. Even though many in the team hadn''t worked directly with the tingster, the organization collectively decided to cancel the celebration. It wasn''t a forced directive — it was a unanimous choice rooted in respect for the grieving family. The moment reaffirmed that ting is more than just a workplace; it''s a family where empathy always takes precedence over festivity.', 'Empathy means people > events; honor collective grief.', ARRAY['culture', 'decision'], now()),

((SELECT id FROM drivers WHERE key = 'empathy'), 'Understanding Before Correcting', 'When a tingster struggles with performance, the instinct is never to rush into punitive measures like a PIP or issue warnings. Instead, managers take time to sit down, listen, and understand what might be affecting them — whether personal challenges, workload imbalances, or skill gaps. Solutions are then co-created to improve conditions and give the individual the best chance to succeed. This empathetic approach ensures tingsters feel supported, not judged, creating an environment where growth becomes natural.', 'Empathy means understanding before judging; support before correcting.', ARRAY['performance', 'management'], now()),

((SELECT id FROM drivers WHERE key = 'empathy'), 'Prioritizing People''s Needs', 'Over the years, ting has consistently prioritized individual well-being, even when it creates short-term strain. Whether it''s granting long breaks for health or personal reasons, or encouraging tingsters to pursue creative passions, initiatives like Me Time and LoveOnly Leaves emerged from this ethos. These policies are not lip service but a cultural choice — a way of saying that people come first. At ting, empathy is embedded in decisions that protect and nurture individuals.', 'Empathy means people''s needs > business convenience.', ARRAY['wellbeing', 'policies'], now()),

-- Integrity Instances
((SELECT id FROM drivers WHERE key = 'integrity'), 'Owning Mistakes Together', 'A social media manager once posted content on the wrong brand page, sparking immediate client outrage. The client demanded the employee''s removal, but the account manager refused to single anyone out. Instead, they took collective responsibility and assured the client the team would fix the issue. This moment showed that integrity at ting isn''t about shifting blame — it''s about solidarity, accountability, and standing by your people.', 'Integrity means collective responsibility, not individual blame.', ARRAY['accountability', 'teamwork'], now()),

((SELECT id FROM drivers WHERE key = 'integrity'), 'Passing on Cost Benefits', 'In one project, a client requested extra deliverables. Industry norms would have allowed ting to double charges, but through smart planning the cost was reduced significantly. Instead of pocketing the savings, ting passed them directly to the client. This decision reinforced that integrity isn''t just about honesty, but also about fairness — building trust that lasts beyond any single transaction.', 'Integrity means fairness over profit; trust over short-term gain.', ARRAY['fairness', 'trust'], now()),

((SELECT id FROM drivers WHERE key = 'integrity'), 'Being Transparent with Conflicts', 'When a new account opportunity came in from the same category as an existing client, ting could have quietly taken it — there was no contractual restriction. Instead, the team proactively reached out to the current client, explained the situation transparently, and sought their blessing before moving forward. This act of openness sent a clear signal: ting values trust over opportunism, and integrity over short-term wins.', 'Integrity means transparency over secrecy; trust over opportunism.', ARRAY['transparency', 'relationships'], now()),

-- Ownership Instances
((SELECT id FROM drivers WHERE key = 'ownership'), 'Protecting Team Balance', 'During a long weekend, critical work had to be delivered. Instead of overloading a small group, one tingster carefully planned tasks so that everyone contributed without being overburdened. The work was delivered smoothly, and the team returned from the weekend energized instead of exhausted. This is what ownership looks like at ting — delivering results while safeguarding the people who make it possible.', 'Ownership means protecting your team while delivering results.', ARRAY['teamwork', 'planning'], now()),

((SELECT id FROM drivers WHERE key = 'ownership'), 'Filling System Gaps', 'At a time when ting had no IT or Admin support, one tingster voluntarily stepped in to manage those responsibilities in addition to their primary role. There was no mandate or promise of reward — just a recognition that the system needed someone to rise to the occasion. Their initiative kept things running seamlessly and symbolized true ownership: stepping up for the greater good without being asked.', 'Ownership means seeing gaps and filling them proactively.', ARRAY['initiative', 'responsibility'], now()),

((SELECT id FROM drivers WHERE key = 'ownership'), 'Leading from the Front', 'When a major client request came in late at night, a senior tingster didn''t simply delegate tasks. Instead, they stayed with the team, working alongside them through the night to ensure flawless delivery. Their presence reassured the team and raised morale. This moment illustrated that real ownership means being accountable and present, especially when the stakes are high.', 'Ownership means being present and accountable in critical moments.', ARRAY['leadership', 'accountability'], now()),

-- Learning & Growth Instances
((SELECT id FROM drivers WHERE key = 'learning_growth'), 'Building New Expertise', 'When ting took on a project that required expertise in a platform unfamiliar to the team, a group of tingsters decided to learn it from scratch. They studied, trained, and even earned certifications to deliver confidently. This demonstrates ting''s culture of growth — turning challenges into opportunities for collective advancement.', 'Learning & Growth means turning challenges into learning opportunities.', ARRAY['expertise', 'certification'], now()),

((SELECT id FROM drivers WHERE key = 'learning_growth'), 'Driving Efficiency with Tools', 'Manual reporting was eating up valuable time and slowing down output. One tingster took the initiative to master a new analytics tool, automated key reporting processes, and then trained the rest of the team. What began as an individual initiative quickly became a collective advantage, saving time and increasing efficiency across the board. This is growth at ting — multiplying impact by lifting the whole system.', 'Learning & Growth means individual learning becomes collective advantage.', ARRAY['automation', 'efficiency'], now()),

((SELECT id FROM drivers WHERE key = 'learning_growth'), 'Experimenting with AI', 'When AI tools began gaining momentum, the creative team at ting decided not to wait for client demand but to experiment proactively. In one instance, the team has created an entire video asset end-to-end using AI — a milestone that demonstrated both risk-taking and adaptability.', 'Learning & Growth means proactive experimentation with emerging technologies.', ARRAY['AI', 'innovation'], now()),

-- One-Ting Instances
((SELECT id FROM drivers WHERE key = 'one_ting'), 'Uniting During COVID', 'During lockdown, ting had to deliver 70+ TVCs across four languages — all while working remotely under fear and uncertainty. Instead of splintering, tingsters pooled skills, shared workloads, and coordinated across geographies. Deliveries went out on time, proving that ting could function as one unified organism even under duress. The episode cemented One-ting as not just a slogan, but a lived reality.', 'One-Ting means unity in adversity; collective strength in crisis.', ARRAY['crisis', 'collaboration'], now()),

((SELECT id FROM drivers WHERE key = 'one_ting'), 'Supporting During Chennai Floods', 'When floods hit Chennai in 2023, power outages made it impossible for the office to function. The smaller Kochi team immediately stepped up, absorbing as much workload as they could. Clients saw no disruption, but internally, tingsters felt the strength of unity in action. One-ting means no one is ever left behind.', 'One-Ting means geographical distance doesn''t break unity.', ARRAY['disaster', 'support'], now()),

((SELECT id FROM drivers WHERE key = 'one_ting'), 'Winning Sun Network', 'In 2018, ting got the opportunity to pitch for Sun Network, one of the largest media houses in the region. Recognizing the stakes, every single tingster in Chennai reorganized their existing work to dedicate two full days solely to the pitch. The effort paid off with a win, and the story of that unified push still inspires tingsters today. Collective sacrifice leading to collective success.', 'One-Ting means collective sacrifice for collective success.', ARRAY['pitch', 'collaboration'], now()),

-- Zoom In – Zoom Out Instances
((SELECT id FROM drivers WHERE key = 'zoom_in_zoom_out'), 'Choosing Long-Term Learning in Aviation', 'The GMR aviation account was challenging and morale-draining. A zoom-in view suggested letting it go, but zooming out revealed its long-term value as a learning opportunity. By holding open conversations with the client and tweaking workflows, ting stayed the course and developed an opportunity to learn and grow. Sometimes, zooming out is the only way to see the bigger reward.', 'Zoom In-Zoom Out means perspective reveals hidden opportunities.', ARRAY['perspective', 'learning'], now()),

((SELECT id FROM drivers WHERE key = 'zoom_in_zoom_out'), 'Fixing Root Causes of Escalations', 'A client once escalated concerns about creativity and delivery. Zooming out, it looked like underperformance by the team. But zooming in revealed the real issue: gaps in daily processes and communication. Once those were fixed, client confidence was quickly restored. The zoom in–zoom out lens ensured ting treated the root cause, not just the symptom.', 'Zoom In-Zoom Out means treating root causes, not symptoms.', ARRAY['problem-solving', 'communication'], now()),

((SELECT id FROM drivers WHERE key = 'zoom_in_zoom_out'), 'Redefining Risk in Commercials', 'A project with revenue-linked commercials looked risky when viewed up close — the payouts seemed uncertain. But zooming out showed a different picture: the model aligned ting''s success directly with the client''s. The arrangement boosted ownership and deepened the partnership. Zoom in–zoom out thinking turns risk into opportunity.', 'Zoom In-Zoom Out means risk becomes opportunity with proper perspective.', ARRAY['risk', 'partnership'], now()),

-- Infinite Game Instances
((SELECT id FROM drivers WHERE key = 'infinite_game'), 'Learning from Setbacks', 'At ting, setbacks — whether losing a pitch, facing client criticism, or missing deadlines — are never seen as endpoints. The culture is to pause, analyze, and extract lessons before moving forward. Corrective measures are put in place, not to cover up mistakes, but to ensure they''re not repeated. This mindset ensures resilience and keeps ting focused on the long run, always playing the infinite game.', 'Infinite Game means setbacks are learning opportunities, not endpoints.', ARRAY['resilience', 'learning'], now()),

((SELECT id FROM drivers WHERE key = 'infinite_game'), 'Long-Term Trust over Short-Term Gains', 'A client once offered a lucrative project with impossibly tight timelines. Taking it would have meant overworking the team and compromising quality. Instead of chasing short-term revenue, ting politely declined and proposed a more realistic approach that protected both outcomes and people. The client appreciated the honesty, and trust deepened — proving that ting is in the relationship for the long haul.', 'Infinite Game means long-term trust over short-term gains.', ARRAY['trust', 'quality'], now()),

((SELECT id FROM drivers WHERE key = 'infinite_game'), 'Investing in Future Capability', 'Even before clients asked for it, ting invested time and resources into exploring AI-driven creative tools. One such initiative produced a complete video asset, not for immediate revenue, but for future readiness. This forward-looking experiment positioned ting ahead of the curve and reinforced the belief in playing the infinite game: staying relevant, prepared, and ahead of change.', 'Infinite Game means investing in future readiness, not just current needs.', ARRAY['innovation', 'readiness'], now()),

-- Servant Leadership Instances
((SELECT id FROM drivers WHERE key = 'servant_leadership'), 'Lifting a Reportee''s Confidence', 'A tingster managing a small team had one reportee struggling with performance. Instead of sidelining or blaming them, the manager built a step-by-step improvement plan, stayed engaged with regular check-ins, and encouraged every small win. Over time, the reportee''s performance and confidence improved dramatically. This is servant leadership at ting — leaders succeed when their people succeed.', 'Servant Leadership means leaders succeed when their people succeed.', ARRAY['mentoring', 'growth'], now()),

((SELECT id FROM drivers WHERE key = 'servant_leadership'), 'Leaders in the Trenches', 'During a crunch period for a high-stakes campaign, ting''s leaders didn''t just monitor progress from the sidelines. They rolled up their sleeves to handle client calls, coordinate revisions, and even take on late-night design tasks alongside their teams. Their actions sent a clear message: at ting, leadership is about shared responsibility, not hierarchy. No task is ever beneath a true leader.', 'Servant Leadership means leaders work alongside their teams.', ARRAY['leadership', 'teamwork'], now()),

((SELECT id FROM drivers WHERE key = 'servant_leadership'), 'Creating Space for Growth', 'A young strategist was once given the responsibility of leading a pitch independently. Leadership stayed available for guidance but deliberately stepped back to let them own the process. Even when minor gaps appeared in the presentation, the effort was celebrated and constructive feedback was given. This approach built confidence and maturity, showing that real leadership lies in empowering others to grow.', 'Servant Leadership means empowering others through trust and space.', ARRAY['empowerment', 'growth'], now());

-- 5. INSERT DEFAULT EVALUATION POLICY (without ON CONFLICT)
INSERT INTO evaluation_policies (name, scale, guidance, min_evidence_items, require_citations, scale_min, scale_max, is_active, created_at) VALUES
('Default Evaluation Policy', '1-5', 'Always provide evidence and cite messages. Use only retrieved chat evidence for scoring. Apply company values as interpretive lenses while maintaining objectivity.', 3, true, 1, 5, true, now());

-- 6. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_drivers_key ON drivers(key);
CREATE INDEX IF NOT EXISTS idx_drivers_client_id ON drivers(client_id);
CREATE INDEX IF NOT EXISTS idx_driver_behaviors_driver_id ON driver_behaviors(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_instances_driver_id ON driver_instances(driver_id);

-- 7. ENABLE ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_behaviors ENABLE ROW LEVEL SECURITY;

-- 8. CREATE RLS POLICIES FOR DRIVERS
CREATE POLICY drivers_select ON drivers
FOR SELECT USING (
  client_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM user_client_access uca 
    WHERE uca.user_id = auth.uid() 
    AND uca.client_id = drivers.client_id
  )
);

CREATE POLICY drivers_insert ON drivers
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM platform_users pu 
    WHERE pu.id = auth.uid() 
    AND pu.platform_role IN ('admin', 'super_admin')
  )
);

-- 9. CREATE RLS POLICIES FOR DRIVER_BEHAVIORS
CREATE POLICY driver_behaviors_select ON driver_behaviors
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM drivers d
    WHERE d.id = driver_behaviors.driver_id
    AND (d.client_id IS NULL OR 
         EXISTS (
           SELECT 1 FROM user_client_access uca 
           WHERE uca.user_id = auth.uid() 
           AND uca.client_id = d.client_id
         ))
  )
);

CREATE POLICY driver_behaviors_insert ON driver_behaviors
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM platform_users pu 
    WHERE pu.id = auth.uid() 
    AND pu.platform_role IN ('admin', 'super_admin')
  )
);

END $$;

-- 10. VERIFICATION QUERY
SELECT 
  'Drivers inserted: ' || COUNT(*) as summary
FROM drivers 
WHERE key IN ('empathy', 'integrity', 'ownership', 'learning_growth', 'one_ting', 'zoom_in_zoom_out', 'infinite_game', 'servant_leadership')

UNION ALL

SELECT 
  'Driver behaviors inserted: ' || COUNT(*) as summary
FROM driver_behaviors

UNION ALL

SELECT 
  'Driver instances inserted: ' || COUNT(*) as summary
FROM driver_instances

UNION ALL

SELECT 
  'Evaluation policy created: ' || COUNT(*) as summary
FROM evaluation_policies 
WHERE name = 'Default Evaluation Policy';
