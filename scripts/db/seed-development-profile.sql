-- Operator-run on Loki's database. Canonical profile content, never used by the site as a fallback.
-- Matches the registered repository, preserves existing unrelated attributes and goals.
BEGIN;
UPDATE user_projects SET description='Open research on the physical bottlenecks of technological progress: materials, compute, energy, science, policy, capital and talent, with checkable evidence and public contributions.', stack='Next.js 16, React 19, TypeScript, PostgreSQL 17, OrangeCat OIDC, @bitbaum/ai-kit, bip-kit and sitekit. Versioned research corpus; derived search, atlas and exports.', updated_at=now() WHERE id='64f150b3-74bf-4b12-959d-541fc3f2c48f';
INSERT INTO attributes(user_id,entity_id,key,value,source)
SELECT p.user_id,p.entity_project_id,v.key,v.value,'User brief and Substrata research corpus, 2026-09-16'
FROM user_projects p CROSS JOIN (VALUES
 ('problem','Critical technology chains are difficult to understand and verify. Sources, companies, bottlenecks and analyst judgements are scattered, and practitioners lack a simple way to correct the record.'),
 ('solution','An open research map joining bottlenecks, producers, science, policy, capital and talent, with evidence links, visual exploration, searchable explanations and a dedicated content contribution inbox.'),
 ('mission','Make the physical constraints on technological progress understandable, checkable and open to correction by people who know the work.'),
 ('vision','A collaborative research service where anyone can follow a technology chain, inspect the evidence behind a claim, personalise their learning and contribute expertise that improves a shared public map.')
) AS v(key,value) WHERE p.id='64f150b3-74bf-4b12-959d-541fc3f2c48f'
ON CONFLICT(user_id,entity_id,key) DO UPDATE SET value=EXCLUDED.value,source=EXCLUDED.source,updated_at=now();
INSERT INTO goals(user_id,entity_id,title,description,status,progress,metadata)
SELECT p.user_id,p.entity_project_id,v.title,v.description,'active',0,'{"programme":"substrata-research-service-2026-09"}'::jsonb
FROM user_projects p CROSS JOIN (VALUES
 ('Explore technology chains with checkable visuals','Atlas, source links, reproducible exports, clearer search and mobile inspection. Verify every count against its producing records.'),
 ('Make Substrata a useful research companion','Cited answers through shared AI infrastructure, explicit durable contributions, OrangeCat sign-in and saved interests. Verify production paths and privacy boundaries.'),
 ('Enrich company, science and talent research','Connect companies to relevant relief mechanisms and expertise gaps. Expand dated primary-source coverage; never fabricate capacities, contracts, vacancies or affiliations.'),
 ('Keep development and public profiles current','Canonical vision, roadmap and changelog on the product and Loki profile, linked OrangeCat presence and development articles. Verify deployed pages against the profile.')
) AS v(title,description) WHERE p.id='64f150b3-74bf-4b12-959d-541fc3f2c48f'
AND NOT EXISTS(SELECT 1 FROM goals g WHERE g.entity_id=p.entity_project_id AND g.title=v.title);
COMMIT;
