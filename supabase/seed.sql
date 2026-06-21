-- ============================================================================
-- StudySync Vietnam — demo seed data
-- ----------------------------------------------------------------------------
-- Run this AFTER schema.sql to populate the database with the same content the
-- app ships in demo mode, so a freshly-connected backend isn't empty.
-- Safe to re-run: it clears the seeded rows first (by their fixed UUIDs).
--
-- Fixed UUIDs are used so foreign keys line up and re-running is idempotent.
-- These are demo AUTHOR profiles (not real auth accounts). Real users who sign
-- up get their own profile row keyed by their Supabase auth id.
-- ============================================================================

-- Clear previously seeded rows (children first).
truncate table
  public.activities, public.achievements,
  public.trending_topics, public.community_posts, public.study_rooms,
  public.quizzes, public.flashcards, public.deck_cards, public.decks,
  public.note_versions, public.notes, public.study_stats, public.subjects,
  public.profiles
restart identity cascade;

-- 1. profiles ----------------------------------------------------------------
insert into public.profiles (id, handle, full_name, email, avatar_url, program, school, location, reputation, tier, percentile, level, xp, xp_next, streak, color, joined) values
  ('11111111-1111-1111-1111-111111111111','minhng','Minh Nguyễn','minh.nguyen@rmit.edu.vn','https://i.pravatar.cc/150?img=12','SWE · RMIT Vietnam','RMIT Vietnam','Hồ Chí Minh',2480,'Gold IV','Top 4%',12,2480,3000,14,'grad-blue','2024-08-01'),
  ('22222222-2222-2222-2222-222222222222','linhtran','Linh Trần','linh.tran@rmit.edu.vn','https://i.pravatar.cc/150?img=47','RMIT · SWE','RMIT Vietnam','Hồ Chí Minh',12400,'Platinum','Top 1%',20,12400,13000,9,'grad-fuchsia','2023-09-01'),
  ('33333333-3333-3333-3333-333333333333','tuanpham','Tuấn Phạm','tuan.pham@vnu.edu.vn','https://i.pravatar.cc/150?img=33','VNU · DS','VNU','Hà Nội',9800,'Gold I','Top 2%',18,9800,10000,5,'grad-green','2023-10-12'),
  ('44444444-4444-4444-4444-444444444444','havu','Hà Vũ','ha.vu@rmit.edu.vn','https://i.pravatar.cc/150?img=45','RMIT · IT','RMIT Vietnam','Đà Nẵng',7100,'Gold III','Top 6%',16,7100,8000,3,'grad-orange','2024-01-20'),
  ('55555555-5555-5555-5555-555555555555','baole','Bảo Lê','bao.le@hcmut.edu.vn','https://i.pravatar.cc/150?img=15','HCMUT · CE','HCMUT','Hồ Chí Minh',5600,'Silver I','Top 9%',14,5600,6000,2,'grad-blue','2024-03-05'),
  ('66666666-6666-6666-6666-666666666666','quynhanh','Quỳnh Anh','quynh.anh@rmit.edu.vn','https://i.pravatar.cc/150?img=49','RMIT · BIS','RMIT Vietnam','Hồ Chí Minh',4200,'Silver II','Top 12%',13,4200,5000,1,'grad-fuchsia','2024-05-18');

-- 2. subjects ----------------------------------------------------------------
insert into public.subjects (id, code, letters, color, name, description, category, rating, notes_count, students, progress) values
  ('a0000001-0000-0000-0000-000000000001','COS30049','COS','grad-blue','Blockchain Tech','Distributed ledgers, consensus mechanisms and smart-contract security.','Computing',4.8,89,1280,78),
  ('a0000002-0000-0000-0000-000000000002','COS30043','COS','grad-green','Interactive Web Apps','Modern front-end engineering with Vue 3, accessibility and responsive design.','Computing',4.9,142,1840,64),
  ('a0000003-0000-0000-0000-000000000003','INF10025','INF','grad-fuchsia','Database Design','Relational modelling, normalisation, indexing and query optimisation.','Computing',4.7,178,2100,64),
  ('a0000004-0000-0000-0000-000000000004','MATH2001','MAT','grad-orange','Linear Algebra','Vector spaces, eigenvalues, decompositions and applications.','Mathematics',4.6,64,980,41),
  ('a0000005-0000-0000-0000-000000000005','COS30018','COS','grad-blue','Intelligent Systems','Search, machine-learning foundations and intelligent agents.','Computing',4.5,73,1120,30),
  ('a0000006-0000-0000-0000-000000000006','BUS20001','BUS','grad-green','Digital Marketing','Growth, analytics and modern D2C marketing channels.','Business',4.4,51,860,0);

-- 3. study_stats (for the signed-in demo identity, Minh) ---------------------
insert into public.study_stats (user_id, weekly_focus, reputation_series, flashcard_stats) values
  ('11111111-1111-1111-1111-111111111111',
   '{"labels":["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],"values":[2.1,3.0,2.4,3.6,2.8,3.9,4.2],"max":8}',
   '{"labels":["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],"values":[180,320,470,520,700,980,1120,1180,1420,1560,1720,1840],"max":2200,"ytd":1840}',
   '{"mastered":95,"dueToday":46,"streak":14,"avgRecall":87,"reviewedLast7":[12,18,9,16,14,22,17],"todayCount":21,"weekCount":130,"retention":87}');

-- 4. notes -------------------------------------------------------------------
insert into public.notes (id, subject_id, author_id, title, week, read_minutes, content, visibility, likes_count, version, updated_at, created_at) values
  ('b0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Consensus Mechanisms — Deep Dive','Week 6',12,
   'In a decentralised network, no single authority decides which transactions are valid. A consensus algorithm is used for letting geographically distributed nodes agree on a single shared state despite faulty or malicious participants. Proof-of-Work is a consensus mechanism that requires miners to solve a computational puzzle. A nonce is a number that miners vary until the block hash is below the target. Proof-of-Stake means validators lock collateral to gain the right to propose blocks. Slashing refers to destroying part of a validator stake as a penalty for dishonest behaviour. Finality means the guarantee that a committed block will never be reverted. A fork occurs when two valid blocks extend the same parent at the same height.',
   'public',64,6,'2026-06-06T09:30:00Z','2026-05-20T09:00:00Z'),
  ('b0000002-0000-0000-0000-000000000002','a0000003-0000-0000-0000-000000000003','33333333-3333-3333-3333-333333333333','Normalisation & BCNF','Week 4',8,
   'Normalisation is the process of organising columns and tables to reduce data redundancy. A functional dependency means one set of attributes determines another. BCNF refers to a normal form where every determinant is a candidate key. A candidate key is a minimal set of attributes that uniquely identifies a row. Decomposition means splitting a relation into smaller relations without losing information.',
   'public',41,3,'2026-06-04T14:15:00Z','2026-05-18T11:00:00Z'),
  ('b0000003-0000-0000-0000-000000000003','a0000002-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Vue Reactivity & Composition API','Week 3',10,
   'The Composition API is used for organising component logic by feature instead of by option. Reactivity refers to the system that automatically updates the DOM when state changes. A ref is a reactive container that holds a single mutable value. Vue Router is used for client-side navigation between pages in a single page application. Pinia is a state management library that allows components to share reactive global state.',
   'public',57,4,'2026-06-05T08:45:00Z','2026-05-15T13:20:00Z'),
  ('b0000004-0000-0000-0000-000000000004','a0000004-0000-0000-0000-000000000004','44444444-4444-4444-4444-444444444444','Eigenvalues for Tridiagonal Matrices','Week 7',9,
   'An eigenvalue is a scalar that scales an eigenvector under a linear transformation. A tridiagonal matrix is a matrix with non-zero entries only on the main and adjacent diagonals. The characteristic polynomial is used for finding eigenvalues by setting its determinant to zero. Diagonalisation means expressing a matrix as a product involving its eigenvalues.',
   'public',33,2,'2026-06-03T16:10:00Z','2026-05-22T10:00:00Z');

-- 5. note_versions (history for the flagship note) ---------------------------
insert into public.note_versions (note_id, content, version_number, summary, edited_by) values
  ('b0000001-0000-0000-0000-000000000001','(earlier revision)',5,'Highlighted energy use callout','33333333-3333-3333-3333-333333333333'),
  ('b0000001-0000-0000-0000-000000000001','(earlier revision)',4,'Restructured PoW section','11111111-1111-1111-1111-111111111111'),
  ('b0000001-0000-0000-0000-000000000001','(earlier revision)',3,'Added PoS validators list','44444444-4444-4444-4444-444444444444');

-- 6. decks + deck_cards ------------------------------------------------------
insert into public.decks (id, name, subject_code, color, due, total) values
  ('c0000001-0000-0000-0000-000000000001','Blockchain Consensus','COS30049','grad-blue',3,24),
  ('c0000002-0000-0000-0000-000000000002','Database Normalisation','INF10025','grad-fuchsia',8,30),
  ('c0000003-0000-0000-0000-000000000003','Vue Composition API','COS30043','grad-green',5,18),
  ('c0000004-0000-0000-0000-000000000004','Linear Algebra Essentials','MATH2001','grad-orange',6,22),
  ('c0000005-0000-0000-0000-000000000005','Intelligent Systems','COS30018','grad-blue',24,40);

insert into public.deck_cards (deck_id, question, answer, position) values
  ('c0000001-0000-0000-0000-000000000001','What is the purpose of slashing in PoS?','To penalise validators who act dishonestly by destroying part of their staked collateral, aligning incentives with honest behaviour.',0),
  ('c0000001-0000-0000-0000-000000000001','What problem does a consensus algorithm solve?','It lets distributed nodes agree on a single shared state even when some participants are faulty or malicious.',1),
  ('c0000001-0000-0000-0000-000000000001','What is a nonce in Proof-of-Work?','A number miners repeatedly change until the block hash falls below the target difficulty.',2),
  ('c0000002-0000-0000-0000-000000000002','What is BCNF?','A normal form where every determinant of a functional dependency is a candidate key.',0),
  ('c0000002-0000-0000-0000-000000000002','What is a functional dependency?','A constraint where one set of attributes uniquely determines another.',1),
  ('c0000003-0000-0000-0000-000000000003','What is reactivity in Vue?','The system that automatically updates the DOM when reactive state changes.',0),
  ('c0000003-0000-0000-0000-000000000003','What is a ref?','A reactive container holding a single mutable value, accessed via .value.',1),
  ('c0000004-0000-0000-0000-000000000004','What is an eigenvalue?','A scalar that scales its eigenvector under a linear transformation.',0),
  ('c0000005-0000-0000-0000-000000000005','What is a heuristic?','A rule-of-thumb estimate used to guide search toward promising solutions.',0);

-- 7. study_rooms -------------------------------------------------------------
insert into public.study_rooms (id, subject_id, code, name, description, live, active_users) values
  ('d0000001-0000-0000-0000-000000000001','a0000001-0000-0000-0000-000000000001','COS30049 · Group 4','Blockchain Final Prep · Friday Crunch','Working chapter 6 problems before the final.',true,6),
  ('d0000002-0000-0000-0000-000000000002','a0000002-0000-0000-0000-000000000002','COS30043 · Group 2','Vue Project Standup','Component architecture and state management.',true,4),
  ('d0000003-0000-0000-0000-000000000003','a0000003-0000-0000-0000-000000000003','INF10025 · Open','Database Design Clinic','Drop-in help on normalisation and ER diagrams.',false,2);

-- 8. community_posts + trending_topics ---------------------------------------
insert into public.community_posts (author_id, subject_code, title, excerpt, tags, votes, replies, answered) values
  ('22222222-2222-2222-2222-222222222222','COS30049','How does Ethereum''s PBS architecture actually work?','Reading the original Flashbots paper but I''m confused about how the proposer commits to a block header before seeing the body. Anyone explain like I''m 5?','{"#Blockchain","#Help"}',248,42,false),
  ('33333333-3333-3333-3333-333333333333','MATH2001','Solved: Eigenvalues for tridiagonal matrices — Vietnamese explanation','Mình giải thích cách tìm trị riêng cho ma trận ba đường chéo bằng đa thức đặc trưng, kèm ví dụ cụ thể bằng tiếng Việt.','{"#LinearAlgebra","#Solved"}',412,31,true),
  ('44444444-4444-4444-4444-444444444444','INF10025','When should I stop at 3NF instead of going to BCNF?','My lecturer said BCNF can sometimes break dependency preservation. How do I decide which trade-off is acceptable in a real schema?','{"#Database","#Discussion"}',176,18,false);

insert into public.trending_topics (tag, posts) values
  ('#PBS & MEV',184),('#Vietnamese eigenvalue',142),('#React 19 hooks',98),
  ('#PoS finality',87),('#BCNF decomposition',64),('#TikTok D2C',52);

-- 9. achievements ------------------------------------------------------------
insert into public.achievements (name, description, icon, color, unlocked, sort) values
  ('14-day streak','Studied every day for 2 weeks','bi-fire','grad-orange',true,1),
  ('Note Maven','47 notes shared with community','bi-file-earmark-text','grad-blue',true,2),
  ('Top 4% Vietnam','Among the top contributors','bi-trophy','grad-orange',true,3),
  ('Quiz Master','Aced 25 quizzes in a row','bi-stars','grad-fuchsia',true,4),
  ('Collaborator','Co-edited 30 live notes','bi-people','grad-green',true,5),
  ('Early Bird','20 sessions before 8am','bi-sunrise','grad-blue',true,6),
  ('Polyglot','Notes in 3 languages','bi-translate','grad-fuchsia',false,7),
  ('Marathoner','100-day study streak','bi-lightning','grad-orange',false,8);

-- 10. activities (Hub feed) --------------------------------------------------
insert into public.activities (actor_id, type, icon, color, i18n_key, params, route_name, route_params) values
  ('22222222-2222-2222-2222-222222222222','note','bi-file-earmark-text','#6366f1','hub.activity.noteEdited','{"title":"Consensus Mechanisms"}','note-detail','{"id":"b0000001-0000-0000-0000-000000000001"}'),
  ('33333333-3333-3333-3333-333333333333','room','bi-people-fill','#10b981','hub.activity.roomShared','{"room":"Blockchain Final Prep"}','study-room','{"id":"d0000001-0000-0000-0000-000000000001"}'),
  ('44444444-4444-4444-4444-444444444444','community','bi-chat-square-text','#d946ef','hub.activity.communityAnswered','{"title":"Ethereum''s PBS architecture"}','community','{}'),
  ('11111111-1111-1111-1111-111111111111','flashcards','bi-stars','#f59e0b','hub.activity.deckMastered','{"n":12,"deck":"Blockchain Consensus"}','flashcards','{}'),
  ('11111111-1111-1111-1111-111111111111','note','bi-file-earmark-text','#6366f1','hub.activity.noteCreated','{"title":"Vue Reactivity & Composition API"}','note-detail','{"id":"b0000003-0000-0000-0000-000000000003"}');
