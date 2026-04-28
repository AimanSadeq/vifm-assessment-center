-- Improve flagged competency descriptions (Phase A audit)

-- Global Perspective: was too vague
UPDATE competencies SET description = 'Taking a broad, cross-cultural view when approaching issues; considering geopolitical, regulatory, and multi-market factors to inform strategy and decision-making.'
WHERE id = 'a0000001-0000-0000-0000-000000000008';

-- Digital Fluency: was too generic
UPDATE competencies SET description = 'Leveraging digital technologies, data analytics, and emerging tools to drive business transformation, enhance operational efficiency, and create competitive advantage.'
WHERE id = 'a0000001-0000-0000-0000-000000000009';

-- Courage: was too short
UPDATE competencies SET description = 'Stepping up to address difficult issues and championing unpopular positions when necessary; challenging the status quo, raising concerns despite personal risk, and standing by convictions in the face of opposition.'
WHERE id = 'a0000001-0000-0000-0000-000000000031';

-- Work-Life Balance → Sustainable Performance: more observable in AC simulations
UPDATE competencies SET name = 'Sustainable Performance', description = 'Managing energy, workload, and priorities to maintain high performance over time; recognizing the importance of recovery and boundary-setting to sustain long-term effectiveness.'
WHERE id = 'a0000001-0000-0000-0000-000000000037';
