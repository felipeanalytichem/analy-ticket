SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") VALUES
	('00000000-0000-0000-0000-000000000000', '136870c9-0f29-4dd9-996f-2163b224289a', '{"action":"user_signedup","actor_id":"07463184-ea33-49fc-ba13-109b9a29eb97","actor_name":"Admin AnalytiChem","actor_username":"admin@analytichem.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-06-26 22:46:11.146945+00', ''),
	('00000000-0000-0000-0000-000000000000', '9933e8f3-c889-4fe0-91ae-c199aa8cba9a', '{"action":"login","actor_id":"07463184-ea33-49fc-ba13-109b9a29eb97","actor_name":"Admin AnalytiChem","actor_username":"admin@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-26 22:46:11.192128+00', ''),
	('00000000-0000-0000-0000-000000000000', '3f256379-b735-4d92-91f2-ef6f5bc6cb58', '{"action":"logout","actor_id":"07463184-ea33-49fc-ba13-109b9a29eb97","actor_name":"Admin AnalytiChem","actor_username":"admin@analytichem.com","actor_via_sso":false,"log_type":"account"}', '2025-06-26 22:46:11.909271+00', ''),
	('00000000-0000-0000-0000-000000000000', '692906b3-901e-4182-90b0-b5dcfadd9eda', '{"action":"user_signedup","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-06-26 22:50:14.252757+00', ''),
	('00000000-0000-0000-0000-000000000000', '1dee2afe-7358-4c2d-8889-7faefc3a9a1e', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-26 22:50:14.27937+00', ''),
	('00000000-0000-0000-0000-000000000000', '6e966b24-256c-4397-99c1-5e991c6fb577', '{"action":"login","actor_id":"07463184-ea33-49fc-ba13-109b9a29eb97","actor_name":"Admin AnalytiChem","actor_username":"admin@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-26 22:59:01.912125+00', ''),
	('00000000-0000-0000-0000-000000000000', '5fbf104c-5455-460e-8417-b8eb8ed37a37', '{"action":"logout","actor_id":"07463184-ea33-49fc-ba13-109b9a29eb97","actor_name":"Admin AnalytiChem","actor_username":"admin@analytichem.com","actor_via_sso":false,"log_type":"account"}', '2025-06-26 22:59:02.854504+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fb59d42d-5811-418e-bc3c-34e7e676a359', '{"action":"login","actor_id":"07463184-ea33-49fc-ba13-109b9a29eb97","actor_name":"Admin AnalytiChem","actor_username":"admin@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-26 22:59:59.857538+00', ''),
	('00000000-0000-0000-0000-000000000000', '41a05f52-3a69-4fa9-a627-14da1d24dce1', '{"action":"logout","actor_id":"07463184-ea33-49fc-ba13-109b9a29eb97","actor_name":"Admin AnalytiChem","actor_username":"admin@analytichem.com","actor_via_sso":false,"log_type":"account"}', '2025-06-26 23:00:00.659301+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bd3d9f30-cbf5-4a24-b907-04fcd1746219', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-26 23:24:32.583722+00', ''),
	('00000000-0000-0000-0000-000000000000', '563a8e79-c332-45e8-88a6-a4efb08fdcfc', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-26 23:48:44.479922+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ca419510-4f1f-4309-8bed-1dd6f00ecb53', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-26 23:48:44.486828+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c3898813-1cdb-4cd9-87de-686b40509d32', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:37:49.609773+00', ''),
	('00000000-0000-0000-0000-000000000000', '897403e2-cc09-4143-949c-bc1eb5f8056d', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:37:49.612274+00', ''),
	('00000000-0000-0000-0000-000000000000', '716ae55a-d745-4512-9995-f24b4861fde7', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:37:50.195713+00', ''),
	('00000000-0000-0000-0000-000000000000', '9f2d5249-4d78-48b0-985f-247822d6d769', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:37:50.196468+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cd82bad0-58f0-472d-9405-63799f7b108a', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:37:50.6351+00', ''),
	('00000000-0000-0000-0000-000000000000', '78379a4a-dcc7-4ede-8092-9141197edf61', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:37:50.635666+00', ''),
	('00000000-0000-0000-0000-000000000000', '790934f1-bccf-41e8-b41b-4136bc0e9561', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:47:14.169987+00', ''),
	('00000000-0000-0000-0000-000000000000', '701eb23c-c1a6-490c-881b-fcd47bc7f203', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 00:47:14.172142+00', ''),
	('00000000-0000-0000-0000-000000000000', '21604146-8e5b-4b9f-be72-f0c25ebcabe0', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 01:36:13.734238+00', ''),
	('00000000-0000-0000-0000-000000000000', '029c2529-3491-4786-ac06-8690674bee06', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 01:36:13.735596+00', ''),
	('00000000-0000-0000-0000-000000000000', '0766f087-62f9-4cda-b555-ca96a6a4bd4c', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 02:34:13.646165+00', ''),
	('00000000-0000-0000-0000-000000000000', 'aca17fcf-c03c-412b-9415-1052540b9035', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 02:34:13.648222+00', ''),
	('00000000-0000-0000-0000-000000000000', '37026adb-87d0-453e-a271-e29811a6516e', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 03:32:13.678875+00', ''),
	('00000000-0000-0000-0000-000000000000', '0b53bed6-8623-49c4-a87c-348750e52540', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 03:32:13.681537+00', ''),
	('00000000-0000-0000-0000-000000000000', '229fdb5c-d4c3-4ea0-9af8-627133171a67', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 04:30:13.694624+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dea81d7b-74d3-4bf8-88df-7a4c44fd914f', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 04:30:13.696705+00', ''),
	('00000000-0000-0000-0000-000000000000', '99e85a7a-3db5-4b78-825b-cf670640befa', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 05:28:13.694584+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd551a38a-3f0e-4139-97c6-4820336af719', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 05:28:13.698031+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b5ae46a0-d8b6-49a2-8194-738e0b2c275a', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 06:26:13.873935+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c62df115-41e3-4264-8f88-b63da338e129', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 06:26:13.878071+00', ''),
	('00000000-0000-0000-0000-000000000000', '8600c856-92d4-4b53-9d7f-e49c57c568ad', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 07:24:13.739531+00', ''),
	('00000000-0000-0000-0000-000000000000', '5081d8a4-d4fd-40a4-bc2c-57697a492fea', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 07:24:13.741681+00', ''),
	('00000000-0000-0000-0000-000000000000', '01202e40-21f5-4ef4-8cc0-3a4d3067c5a2', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 08:38:15.62446+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b4471ba1-02da-4673-8ab2-ec448209f15d', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 08:38:15.625961+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b775ee3c-3642-4405-ac7d-b9e25a5d4709', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-27 08:38:16.323492+00', ''),
	('00000000-0000-0000-0000-000000000000', '0bc13c8b-36d0-4e7e-87ea-f038fdc1d8be', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 07:37:55.986815+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e31ae1e4-a840-4a5f-85a5-8ef6d0ae2723', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 07:37:55.986025+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bb455ace-651c-47fb-a9f9-a7afd486de6c', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 07:37:56.007699+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e9e81c3e-4617-4202-8c88-828babab9635', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 07:37:56.009103+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f55d3195-b7ed-4cfd-8475-550c655e049a', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 08:35:58.454117+00', ''),
	('00000000-0000-0000-0000-000000000000', '9349e9e2-1509-4635-9696-486f2d7bf4cc', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 08:35:58.462032+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c1522115-eb51-42c8-9389-beab07d9f65e', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 08:36:26.526869+00', ''),
	('00000000-0000-0000-0000-000000000000', '4d2ea721-733c-4aa7-b125-fcca711c3129', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 08:36:26.52746+00', ''),
	('00000000-0000-0000-0000-000000000000', '9feece49-6dfb-4803-9d1f-992f010d1492', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 09:24:17.31148+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dee024b4-f95a-411e-b57c-269705ee1785', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 10:07:20.107982+00', ''),
	('00000000-0000-0000-0000-000000000000', '7e390aa9-0e83-4b6e-8cb3-72032d1feca3', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 10:07:20.111488+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b6cf128d-7577-449d-a323-c4f0675a8d39', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 10:23:37.374594+00', ''),
	('00000000-0000-0000-0000-000000000000', '793068ee-4ea4-49b0-a71c-13b23bfecd9b', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 10:23:37.383764+00', ''),
	('00000000-0000-0000-0000-000000000000', '282fa48b-790f-49dd-9ff2-ff2d07d66e91', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 11:05:50.344077+00', ''),
	('00000000-0000-0000-0000-000000000000', 'be7049ea-b487-4d4d-9919-492213436832', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 11:05:50.347418+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e94ad3ba-55ec-4372-86c3-e1e58b60d843', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 11:22:37.331627+00', ''),
	('00000000-0000-0000-0000-000000000000', '121f57bc-b5da-4c0d-9b5d-dd4e31585503', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 11:22:37.333804+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fc4f46fa-0fcc-40d1-abb7-0b2bbed16636', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 12:21:13.534873+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cd82f1cf-76a3-4161-ad4a-d8a2b165cbe9', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 12:21:13.539931+00', ''),
	('00000000-0000-0000-0000-000000000000', '7b7c7254-6872-44b7-895a-1a626e66f976', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 13:34:36.373201+00', ''),
	('00000000-0000-0000-0000-000000000000', '95be2189-40c2-4720-bed3-c61d262c8bf1', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 13:34:36.375301+00', ''),
	('00000000-0000-0000-0000-000000000000', '15869f87-79d4-48c0-bfa1-888dfe0d86b1', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 13:38:17.254419+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a13e5f95-3157-42f3-ad13-914842a3dd84', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 13:38:17.255801+00', ''),
	('00000000-0000-0000-0000-000000000000', '27222d0d-9f30-42df-a06c-eaab691a67fc', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 14:36:47.357899+00', ''),
	('00000000-0000-0000-0000-000000000000', '695b5139-e2a2-4368-aa89-eb0021b01aa1', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 14:36:47.366605+00', ''),
	('00000000-0000-0000-0000-000000000000', '20f820d4-a2c9-420f-95d4-c7f1f19cadd8', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:38:59.626592+00', ''),
	('00000000-0000-0000-0000-000000000000', '8f578d16-af97-439a-b9d8-ad0337b9d1f5', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:39:08.389739+00', ''),
	('00000000-0000-0000-0000-000000000000', '49592d9f-9a45-433a-852c-5d2f1112aeaa', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:39:12.446209+00', ''),
	('00000000-0000-0000-0000-000000000000', '4f64cc55-d3d4-4249-841a-072e6a47608a', '{"action":"logout","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account"}', '2025-06-30 14:39:15.563789+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ae17db48-c80c-4cdf-ad93-f22302d9df04', '{"action":"user_signedup","actor_id":"bf2ae210-4548-4aaa-9468-18d7c4e1e542","actor_name":"QA Automação","actor_username":"qa_1751294560374@example.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-06-30 14:42:42.542075+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e58c9c41-d98b-47dd-b334-d0964c185b6b', '{"action":"login","actor_id":"bf2ae210-4548-4aaa-9468-18d7c4e1e542","actor_name":"QA Automação","actor_username":"qa_1751294560374@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:42:42.551654+00', ''),
	('00000000-0000-0000-0000-000000000000', '52f0d483-8bb8-4ac7-bd95-011693f3b14d', '{"action":"user_signedup","actor_id":"4e931881-dc42-43f9-8da1-65b051d1819a","actor_name":"QA Automação","actor_username":"qa@example.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-06-30 14:42:44.807554+00', ''),
	('00000000-0000-0000-0000-000000000000', '733f3767-5b2c-4b7e-bb84-53a21e8cf1b7', '{"action":"login","actor_id":"4e931881-dc42-43f9-8da1-65b051d1819a","actor_name":"QA Automação","actor_username":"qa@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:42:44.814275+00', ''),
	('00000000-0000-0000-0000-000000000000', '25a0b95a-143e-4294-a437-d037243ff4bc', '{"action":"user_signedup","actor_id":"698ff8cf-c9f7-4106-a23f-bbcd98b55d4d","actor_name":"QA Automação","actor_username":"qa_1751294589626@example.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-06-30 14:43:11.744639+00', ''),
	('00000000-0000-0000-0000-000000000000', '1edbe468-60f8-4c72-8d64-157093a23f34', '{"action":"login","actor_id":"698ff8cf-c9f7-4106-a23f-bbcd98b55d4d","actor_name":"QA Automação","actor_username":"qa_1751294589626@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:43:11.747634+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd080f073-c30a-4a80-8188-d6187b6ee825', '{"action":"user_repeated_signup","actor_id":"4e931881-dc42-43f9-8da1-65b051d1819a","actor_name":"QA Automação","actor_username":"qa@example.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}', '2025-06-30 14:43:13.916862+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c8d15a19-6069-4b56-bef9-e999242e8349', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:43:29.397182+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd396bd4b-f329-4b91-be82-cc6728d70b76', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:48:59.758771+00', ''),
	('00000000-0000-0000-0000-000000000000', '48738937-17b0-4771-81d1-144941476c64', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:49:32.874936+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e7e66145-20a3-4478-9e06-8de81c67d9bd', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:50:07.909768+00', ''),
	('00000000-0000-0000-0000-000000000000', '6b64640e-2f70-4897-bd4b-375dc7d73447', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:51:05.932356+00', ''),
	('00000000-0000-0000-0000-000000000000', '97e451a6-b591-4269-bbdd-c52f87b5e1ec', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:51:10.613275+00', ''),
	('00000000-0000-0000-0000-000000000000', '40a22366-a2ef-43ec-9f9c-970f0a930800', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:51:12.681568+00', ''),
	('00000000-0000-0000-0000-000000000000', '93570685-cf35-412b-a844-0171611bca2b', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:51:58.773411+00', ''),
	('00000000-0000-0000-0000-000000000000', '3457cd68-d1a6-4f1e-958d-d422c96482c5', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:52:04.154222+00', ''),
	('00000000-0000-0000-0000-000000000000', '522997fa-dd64-4cc9-9f83-d0750400488b', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:52:06.165986+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd9627f25-c5e9-4fe8-b627-d85930af4150', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:53:06.049747+00', ''),
	('00000000-0000-0000-0000-000000000000', '9ccca2fa-d815-4ebb-9dfd-231593f7b246', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:53:09.116046+00', ''),
	('00000000-0000-0000-0000-000000000000', '7d94b565-c12e-4868-8a57-65f471dfb62f', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:53:49.722109+00', ''),
	('00000000-0000-0000-0000-000000000000', '94781185-505b-44a0-adbe-0466b2608ed2', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:55:17.376602+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f057b3d6-494e-4687-8c49-28a1c1ce74d0', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:56:28.147913+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b3b0080a-920a-4070-8baf-fb0bd484d2df', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:56:48.318363+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b773abb4-a530-430c-9997-632922278b64', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:56:58.750658+00', ''),
	('00000000-0000-0000-0000-000000000000', '7acd628f-4d3a-4d89-8baa-d76285fc0003', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:57:03.071645+00', ''),
	('00000000-0000-0000-0000-000000000000', '11980afd-9726-48ea-8b48-f23868edad92', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 14:57:07.213433+00', ''),
	('00000000-0000-0000-0000-000000000000', '00417c32-5998-4774-8220-21467e084025', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 15:52:13.887019+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f01f66d8-7ef1-4b04-a61c-da5d14894e3c', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 15:52:13.894229+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b6ce0138-119b-4ffe-8c7a-1bc66483cae6', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 15:55:09.035574+00', ''),
	('00000000-0000-0000-0000-000000000000', '1c44ef55-226d-4152-a1f9-52c0958574db', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 15:55:09.037815+00', ''),
	('00000000-0000-0000-0000-000000000000', '275b8264-c1c7-446c-84ea-195583a17ee1', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 16:50:13.760467+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a1384d11-952d-44bf-9de0-adc021040aa3', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 16:50:13.763635+00', ''),
	('00000000-0000-0000-0000-000000000000', '45fe825d-7f54-469a-b638-c99dd74e3ec3', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 16:53:38.854854+00', ''),
	('00000000-0000-0000-0000-000000000000', '9b00f7d9-2a6f-4166-a33c-83e123f39577', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 16:53:38.857225+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b9d46044-30cb-412a-a1ff-e18d53c39f06', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 17:51:38.895951+00', ''),
	('00000000-0000-0000-0000-000000000000', 'da223e8e-ae92-40a6-af37-c5f85cf8f889', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 17:51:38.899458+00', ''),
	('00000000-0000-0000-0000-000000000000', '996569d0-8cb2-4a6d-ae86-7b3baeb31552', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 19:22:45.00676+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ca4f8827-529e-4a3e-a39f-1eceae598a18', '{"action":"user_signedup","actor_id":"89fb2f47-8781-417a-969c-66f4c2d285ac","actor_name":"shravan.muchandi@analytichem.com","actor_username":"shravan.muchandi@analytichem.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-06-30 19:26:45.872353+00', ''),
	('00000000-0000-0000-0000-000000000000', '995ce8c6-845f-48e9-95a1-256e8a96278c', '{"action":"login","actor_id":"89fb2f47-8781-417a-969c-66f4c2d285ac","actor_name":"shravan.muchandi@analytichem.com","actor_username":"shravan.muchandi@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-06-30 19:26:45.889042+00', ''),
	('00000000-0000-0000-0000-000000000000', '6e1d1d2e-2fcf-4aae-b20b-927eefcb1857', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 20:39:04.522427+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b7db4130-bd29-4002-9b2c-547dc4d2d994', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-06-30 20:39:04.530428+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e2d92e7b-7ae6-4341-ae6f-e3a57abf58f8', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 08:54:40.034569+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b8076e8e-1971-445d-be04-d90708aa3973', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 08:54:40.056243+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c45139bc-ff42-4059-8fe6-e5c751f21132', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-01 09:00:58.162006+00', ''),
	('00000000-0000-0000-0000-000000000000', '2d78c917-ac42-422c-9a23-b628a3c120c7', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 09:02:37.102383+00', ''),
	('00000000-0000-0000-0000-000000000000', '8efe997d-d6e1-4c57-8681-5a13300e7f67', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 09:02:37.1032+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c089dc6a-03d2-4f2c-95f3-d95be09c1355', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 09:52:40.915589+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bc3f7fea-10cd-4b64-ad0e-afc2e77ab896', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 09:52:40.920993+00', ''),
	('00000000-0000-0000-0000-000000000000', '618efdab-f556-44bd-b394-b10be9c151e6', '{"action":"logout","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account"}', '2025-07-01 10:08:00.76823+00', ''),
	('00000000-0000-0000-0000-000000000000', '0dc8c637-6563-4343-9a91-52b3613469d4', '{"action":"user_signedup","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"team","traits":{"provider":"email"}}', '2025-07-01 10:15:38.752931+00', ''),
	('00000000-0000-0000-0000-000000000000', '5153b082-570e-4b89-874e-38161cbfc1bc', '{"action":"login","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-01 10:15:38.76119+00', ''),
	('00000000-0000-0000-0000-000000000000', '83ba3ac6-12db-414f-b2d5-d6c234586de7', '{"action":"token_refreshed","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 11:14:24.048263+00', ''),
	('00000000-0000-0000-0000-000000000000', '9bcd5167-f382-42d2-b15e-9790db465f73', '{"action":"token_revoked","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 11:14:24.049851+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b079fbd4-3522-4d86-9313-576205e36d0d', '{"action":"token_refreshed","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 12:13:23.976417+00', ''),
	('00000000-0000-0000-0000-000000000000', '9ea5a9c6-a242-4f67-a1a9-f6116fdeec06', '{"action":"token_revoked","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 12:13:23.977834+00', ''),
	('00000000-0000-0000-0000-000000000000', '7a6258e6-5337-4d0e-9b41-9f2da1bbc6ab', '{"action":"token_refreshed","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 13:12:24.016422+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f2086d84-a080-4f0f-97f2-502e3cce38ca', '{"action":"token_revoked","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 13:12:24.019752+00', ''),
	('00000000-0000-0000-0000-000000000000', '4691fa56-6082-4a9e-8d2e-8f2e4679d79b', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-01 14:05:32.134317+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c67c5d7c-5203-46e9-856a-1be7166dddcd', '{"action":"token_refreshed","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 14:11:09.875454+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a362e34f-bfa3-4e69-91d1-ee7611f30f44', '{"action":"token_revoked","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 14:11:09.879425+00', ''),
	('00000000-0000-0000-0000-000000000000', '383d0201-1811-49d3-9c01-937ab02b2e7f', '{"action":"logout","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"account"}', '2025-07-01 14:42:29.5712+00', ''),
	('00000000-0000-0000-0000-000000000000', '56d52157-adb5-4458-8368-3dcaf02bcb95', '{"action":"login","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-01 14:42:38.388451+00', ''),
	('00000000-0000-0000-0000-000000000000', 'eac09985-fff8-4e0a-8c99-93c04ab0c5cb', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 15:03:56.368533+00', ''),
	('00000000-0000-0000-0000-000000000000', '4fcad394-1460-40a6-978e-cf459a7661ec', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 15:03:56.37605+00', ''),
	('00000000-0000-0000-0000-000000000000', '0232db7f-c95e-4d88-9142-edc2a73a9270', '{"action":"token_refreshed","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 15:40:50.294524+00', ''),
	('00000000-0000-0000-0000-000000000000', '4dbb5dd4-5d8a-4fd1-84f1-6a9b87d2d682', '{"action":"token_revoked","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 15:40:50.300573+00', ''),
	('00000000-0000-0000-0000-000000000000', '455d1226-af17-480f-8e3b-848ff99c5684', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 16:02:22.751654+00', ''),
	('00000000-0000-0000-0000-000000000000', '8bc76c97-fd6d-4a7f-8c63-035aae45b31c', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-01 16:02:22.754927+00', ''),
	('00000000-0000-0000-0000-000000000000', '405de704-98bf-41d7-bdf6-1486d01f96f4', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-02 08:42:19.022703+00', ''),
	('00000000-0000-0000-0000-000000000000', '793d1758-b691-4719-a94c-56583009bf89', '{"action":"token_refreshed","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 13:05:09.046412+00', ''),
	('00000000-0000-0000-0000-000000000000', 'aae8cc62-7057-4b27-a09a-f1d316f6c262', '{"action":"token_revoked","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 13:05:09.061632+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ecaa5f0b-8462-4015-b169-1ec572ff5936', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 13:05:24.674642+00', ''),
	('00000000-0000-0000-0000-000000000000', '294c5635-2734-418b-b31f-50f0f20e6f33', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 13:05:24.675219+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a84a8b66-3c61-47e4-a9e2-efe0a6558739', '{"action":"token_refreshed","actor_id":"89fb2f47-8781-417a-969c-66f4c2d285ac","actor_name":"shravan.muchandi@analytichem.com","actor_username":"shravan.muchandi@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 13:21:38.06808+00', ''),
	('00000000-0000-0000-0000-000000000000', '4765936b-fe3c-4318-b1da-b7429c0482f9', '{"action":"token_revoked","actor_id":"89fb2f47-8781-417a-969c-66f4c2d285ac","actor_name":"shravan.muchandi@analytichem.com","actor_username":"shravan.muchandi@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 13:21:38.074233+00', ''),
	('00000000-0000-0000-0000-000000000000', '25197229-3bfe-447b-a4ac-9ddea8819574', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-02 13:45:51.857541+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c8fbf28c-0776-4903-a452-04a67e24bf2a', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 14:44:30.931319+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b11248cc-a34e-4bb6-9bf5-90f882319ce1', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 14:44:30.944992+00', ''),
	('00000000-0000-0000-0000-000000000000', '355d2623-0a67-462c-9bdb-2b1b3f88bdca', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 18:57:09.499314+00', ''),
	('00000000-0000-0000-0000-000000000000', '527d26b8-a221-4d73-8599-de8a44b4b33b', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 18:57:09.501896+00', ''),
	('00000000-0000-0000-0000-000000000000', '449735b6-0f46-4880-b193-c93e7102e31b', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 18:58:42.63986+00', ''),
	('00000000-0000-0000-0000-000000000000', '8926876f-2a40-4915-96b5-e00ea1cc71a2', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 18:58:42.641424+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ecc94665-180a-42b5-b819-213b58e2e9a8', '{"action":"logout","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account"}', '2025-07-02 19:40:17.967468+00', ''),
	('00000000-0000-0000-0000-000000000000', '04524104-fc76-4462-921a-aba3ca95317c', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-02 19:42:38.857045+00', ''),
	('00000000-0000-0000-0000-000000000000', '9a4070d3-1c95-409e-acd5-a49248622bd4', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 20:41:20.594494+00', ''),
	('00000000-0000-0000-0000-000000000000', '2beb575c-f70e-4ce8-9f32-6f6bcfde74ae', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 20:41:20.602332+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bb47761f-bd5a-4d7b-8999-2527736f53ab', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 21:39:40.200804+00', ''),
	('00000000-0000-0000-0000-000000000000', '71fb518d-e58b-49df-a5d2-c6dae69b9e86', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-02 21:39:40.208189+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd0936599-54ec-40c1-bb86-3db502990a6a', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 05:25:23.076726+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cd008d8d-e835-48c8-8c45-aecb8c4afc99', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 05:25:23.092728+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a7abd189-d362-4e19-97aa-de2cf2e7df67', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 07:25:18.369371+00', ''),
	('00000000-0000-0000-0000-000000000000', '0914a862-4bdf-4af5-8886-ed48c4914ee3', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 07:25:18.374987+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c77b6df4-27aa-4c46-9d40-36870ee92222', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 08:24:07.995411+00', ''),
	('00000000-0000-0000-0000-000000000000', '49d33443-bf31-4e68-801d-2abf59f76462', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 08:24:08.001711+00', ''),
	('00000000-0000-0000-0000-000000000000', '918bffe7-9fdf-43f2-a08f-58486eff30ad', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 09:48:15.206721+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fde77b0b-5dab-468b-a8a7-6798d5a41ee0', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 09:48:15.213578+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c4f1e8d0-7fca-4a94-bf82-5a8becad5b9a', '{"action":"token_refreshed","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 10:33:32.540615+00', ''),
	('00000000-0000-0000-0000-000000000000', 'eb027305-3df9-4338-aa57-601e540d7913', '{"action":"token_revoked","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 10:33:32.547544+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b2d072d0-2f86-4f1f-b2a9-02bb8b5f958e', '{"action":"logout","actor_id":"d897b994-3a4a-46f6-889c-400973aad4b7","actor_name":"User Test Account","actor_username":"test.agent@contoso.com","actor_via_sso":false,"log_type":"account"}', '2025-07-03 10:33:58.272427+00', ''),
	('00000000-0000-0000-0000-000000000000', '561ad7a4-1318-4be2-b7a7-3dd2357b2035', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-03 10:34:06.253644+00', ''),
	('00000000-0000-0000-0000-000000000000', '0f58b4ec-1007-4ac1-9cf1-e795a6e579a6', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 10:46:45.247754+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd7415a96-3d6a-473c-98af-c485d05e6b91', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 10:46:45.252229+00', ''),
	('00000000-0000-0000-0000-000000000000', '4c39573f-2520-44bb-9830-fd44b2963ea8', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 11:33:07.97715+00', ''),
	('00000000-0000-0000-0000-000000000000', '110d8fcc-8e0b-436b-bc49-87026a341423', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 11:33:07.982787+00', ''),
	('00000000-0000-0000-0000-000000000000', '4c4eddaf-ce00-4069-b4ef-e388fde91274', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 11:45:22.922178+00', ''),
	('00000000-0000-0000-0000-000000000000', '04d0cade-cc09-4efb-9042-ff9aa96cc836', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 11:45:22.923794+00', ''),
	('00000000-0000-0000-0000-000000000000', '80e75c4f-eba1-4f26-8181-3d68ffbb8fc2', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 12:31:58.129957+00', ''),
	('00000000-0000-0000-0000-000000000000', 'aa5d101c-a499-411b-9970-21415b5c2f99', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 12:31:58.133144+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd3948199-208c-4cd0-8eb7-98f6ae66dd94', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 12:44:08.005389+00', ''),
	('00000000-0000-0000-0000-000000000000', '870264b5-f6f1-461b-9e72-912a97f1ddc1', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 12:44:08.00785+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cc97662e-36f8-49a3-b162-5ba83e19ffa7', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 13:31:12.051712+00', ''),
	('00000000-0000-0000-0000-000000000000', '1b778e55-7acb-48db-84f2-c88ffc3fe36a', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 13:31:12.055185+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd466a268-7c13-4a2c-a594-4b59a0e88acf', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 13:42:47.890687+00', ''),
	('00000000-0000-0000-0000-000000000000', '6e813659-6883-4536-983a-e33c9bc1b0c6', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 13:42:47.893184+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f0436cfc-b020-4b56-8615-8ea9d634fa56', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 14:30:08.098799+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c31cc2cc-9813-4e00-954c-8f66d5a31a62', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 14:30:08.106104+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd4eaaa68-2c1e-4276-a9f6-9e188c22ae72', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 14:41:10.294383+00', ''),
	('00000000-0000-0000-0000-000000000000', '189a525f-d5e2-4715-82b6-5ea8ace92572', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 14:41:10.295225+00', ''),
	('00000000-0000-0000-0000-000000000000', '8f640c59-f384-4be9-a1fc-7afbdc592a7c', '{"action":"logout","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account"}', '2025-07-03 15:06:01.16737+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c03d5805-15e0-4856-a8fd-013a4b606ce3', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-03 15:06:23.504558+00', ''),
	('00000000-0000-0000-0000-000000000000', '3c4676ec-11b7-4c43-9d0d-a46567df76fc', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 16:04:53.38196+00', ''),
	('00000000-0000-0000-0000-000000000000', '00333697-3db7-411d-b555-4b77107e3fd1', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-03 16:04:53.387812+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a9c459e5-2854-4eee-9c31-ca1dbf7cb286', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 08:01:40.075036+00', ''),
	('00000000-0000-0000-0000-000000000000', '3f502621-6af9-474c-8fac-1985d773baf0', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 08:01:40.094551+00', ''),
	('00000000-0000-0000-0000-000000000000', '556a1453-2396-4137-8b96-6e59e0d8015e', '{"action":"login","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-07-04 08:36:22.227888+00', ''),
	('00000000-0000-0000-0000-000000000000', '531aabe2-d3bc-45a9-9d3e-5a54cf8441e3', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 10:36:52.66173+00', ''),
	('00000000-0000-0000-0000-000000000000', '4e41118e-2023-4a02-9059-d26ea2e8600d', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 10:36:52.668573+00', ''),
	('00000000-0000-0000-0000-000000000000', '31a36742-d96f-43bf-b642-bccddf296fe1', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 11:36:12.56282+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b12f3261-2d5c-4d2b-94d0-c6963fabf04b', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 11:36:12.568053+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd243d51f-d641-4a3a-97b4-a7ce49a07468', '{"action":"token_refreshed","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 12:35:12.55891+00', ''),
	('00000000-0000-0000-0000-000000000000', '8bdab371-1fc8-4660-ba7c-b834f9f54c3e', '{"action":"token_revoked","actor_id":"5ac2883b-68c6-4ebb-b960-9a4171c048fe","actor_name":"Felipe dos Santos Henrique","actor_username":"felipe.henrique@analytichem.com","actor_via_sso":false,"log_type":"token"}', '2025-07-04 12:35:12.562155+00', '');


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '4e931881-dc42-43f9-8da1-65b051d1819a', 'authenticated', 'authenticated', 'qa@example.com', '$2a$10$66K9TsPyjNac4DfQo68fn.QG7r5mWnq2GpYxyp6eaFjSXZ780kE0a', '2025-06-30 14:42:44.808032+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-06-30 14:42:44.814814+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "4e931881-dc42-43f9-8da1-65b051d1819a", "role": "user", "email": "qa@example.com", "full_name": "QA Automação", "email_verified": true, "phone_verified": false}', NULL, '2025-06-30 14:42:44.797683+00', '2025-06-30 14:42:44.817012+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'bf2ae210-4548-4aaa-9468-18d7c4e1e542', 'authenticated', 'authenticated', 'qa_1751294560374@example.com', '$2a$10$X93TZ8LL0WdXMMkxLrbexur8FSvqBw3mB8AUDT65PHstn5IVSJxD6', '2025-06-30 14:42:42.54396+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-06-30 14:42:42.552217+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "bf2ae210-4548-4aaa-9468-18d7c4e1e542", "role": "user", "email": "qa_1751294560374@example.com", "full_name": "QA Automação", "email_verified": true, "phone_verified": false}', NULL, '2025-06-30 14:42:42.509458+00', '2025-06-30 14:42:42.555923+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'authenticated', 'authenticated', 'shravan.muchandi@analytichem.com', '$2a$10$EBYcJUl5uun5blil4MUAGekO1rHT2Ru4cNjEV.OGSEbi3GBZm9gKK', '2025-06-30 19:26:45.878787+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-06-30 19:26:45.889577+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "89fb2f47-8781-417a-969c-66f4c2d285ac", "role": "user", "email": "shravan.muchandi@analytichem.com", "full_name": "shravan.muchandi@analytichem.com", "email_verified": true, "phone_verified": false}', NULL, '2025-06-30 19:26:45.833473+00', '2025-07-02 13:21:38.080722+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '07463184-ea33-49fc-ba13-109b9a29eb97', 'authenticated', 'authenticated', 'admin@analytichem.com', '$2a$10$RMMx8YIi5vCuk7XLwYhJR./Efb2RfGevnoMp0zmFuG0VJ/3d1ROjW', '2025-06-26 22:46:11.167003+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-06-26 22:59:59.859523+00', '{"provider": "email", "providers": ["email"]}', '{"role": "admin", "full_name": "Admin AnalytiChem"}', NULL, '2025-06-26 22:46:10.974214+00', '2025-06-26 22:59:59.874792+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '698ff8cf-c9f7-4106-a23f-bbcd98b55d4d', 'authenticated', 'authenticated', 'qa_1751294589626@example.com', '$2a$10$Kww7Fmg3J8N4.5e/N8wPyOsnez8C.HgD3G6EbF/eEA9qHW2LeQ9Ki', '2025-06-30 14:43:11.745106+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-06-30 14:43:11.748125+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "698ff8cf-c9f7-4106-a23f-bbcd98b55d4d", "role": "user", "email": "qa_1751294589626@example.com", "full_name": "QA Automação", "email_verified": true, "phone_verified": false}', NULL, '2025-06-30 14:43:11.736484+00', '2025-06-30 14:43:11.750488+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'authenticated', 'authenticated', 'test.agent@contoso.com', '$2a$10$JkwY7tLbOx6oV3T4ke2i1.KoeVlFbpUCIk4HJF2ndJDoXHlKxzG0G', '2025-07-01 10:15:38.754948+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-07-01 14:42:38.39027+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "d897b994-3a4a-46f6-889c-400973aad4b7", "role": "user", "email": "test.agent@contoso.com", "full_name": "User Test Account", "email_verified": true, "phone_verified": false}', NULL, '2025-07-01 10:15:38.730963+00', '2025-07-03 10:33:32.553133+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'authenticated', 'authenticated', 'felipe.henrique@analytichem.com', '$2a$10$DZWxLD9iYf1d5ST18OgeveL2BKgV0b.pxs3csxatwzv/eSWes1r8m', '2025-06-26 22:50:14.262138+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-07-04 08:36:22.238757+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "5ac2883b-68c6-4ebb-b960-9a4171c048fe", "role": "user", "email": "felipe.henrique@analytichem.com", "full_name": "Felipe dos Santos Henrique", "email_verified": true, "phone_verified": false}', NULL, '2025-06-26 22:50:14.090538+00', '2025-07-04 12:35:12.56682+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('07463184-ea33-49fc-ba13-109b9a29eb97', '07463184-ea33-49fc-ba13-109b9a29eb97', '{"sub": "07463184-ea33-49fc-ba13-109b9a29eb97", "role": "admin", "email": "admin@analytichem.com", "full_name": "Admin AnalytiChem", "email_verified": false, "phone_verified": false}', 'email', '2025-06-26 22:46:11.118734+00', '2025-06-26 22:46:11.121688+00', '2025-06-26 22:46:11.121688+00', 'c403ba11-86b0-4e4f-b6d1-202aa90bcf21'),
	('5ac2883b-68c6-4ebb-b960-9a4171c048fe', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '{"sub": "5ac2883b-68c6-4ebb-b960-9a4171c048fe", "role": "user", "email": "felipe.henrique@analytichem.com", "full_name": "Felipe dos Santos Henrique", "email_verified": false, "phone_verified": false}', 'email', '2025-06-26 22:50:14.229001+00', '2025-06-26 22:50:14.230277+00', '2025-06-26 22:50:14.230277+00', '8c4aeb47-08d3-4c75-a921-019d3f63c111'),
	('bf2ae210-4548-4aaa-9468-18d7c4e1e542', 'bf2ae210-4548-4aaa-9468-18d7c4e1e542', '{"sub": "bf2ae210-4548-4aaa-9468-18d7c4e1e542", "role": "user", "email": "qa_1751294560374@example.com", "full_name": "QA Automação", "email_verified": false, "phone_verified": false}', 'email', '2025-06-30 14:42:42.535529+00', '2025-06-30 14:42:42.535584+00', '2025-06-30 14:42:42.535584+00', '9a27403a-3362-4f9c-9550-0ac0fd27ce17'),
	('4e931881-dc42-43f9-8da1-65b051d1819a', '4e931881-dc42-43f9-8da1-65b051d1819a', '{"sub": "4e931881-dc42-43f9-8da1-65b051d1819a", "role": "user", "email": "qa@example.com", "full_name": "QA Automação", "email_verified": false, "phone_verified": false}', 'email', '2025-06-30 14:42:44.801766+00', '2025-06-30 14:42:44.802788+00', '2025-06-30 14:42:44.802788+00', '786ae7a6-4850-43d7-b639-07d4688ccb9f'),
	('698ff8cf-c9f7-4106-a23f-bbcd98b55d4d', '698ff8cf-c9f7-4106-a23f-bbcd98b55d4d', '{"sub": "698ff8cf-c9f7-4106-a23f-bbcd98b55d4d", "role": "user", "email": "qa_1751294589626@example.com", "full_name": "QA Automação", "email_verified": false, "phone_verified": false}', 'email', '2025-06-30 14:43:11.742701+00', '2025-06-30 14:43:11.742751+00', '2025-06-30 14:43:11.742751+00', 'dde820a9-9b5f-4448-abd5-fe524cab5511'),
	('89fb2f47-8781-417a-969c-66f4c2d285ac', '89fb2f47-8781-417a-969c-66f4c2d285ac', '{"sub": "89fb2f47-8781-417a-969c-66f4c2d285ac", "role": "user", "email": "shravan.muchandi@analytichem.com", "full_name": "shravan.muchandi@analytichem.com", "email_verified": false, "phone_verified": false}', 'email', '2025-06-30 19:26:45.864206+00', '2025-06-30 19:26:45.864269+00', '2025-06-30 19:26:45.864269+00', 'ffade796-460c-4eab-af7b-a025b41ce176'),
	('d897b994-3a4a-46f6-889c-400973aad4b7', 'd897b994-3a4a-46f6-889c-400973aad4b7', '{"sub": "d897b994-3a4a-46f6-889c-400973aad4b7", "role": "user", "email": "test.agent@contoso.com", "full_name": "User Test Account", "email_verified": false, "phone_verified": false}', 'email', '2025-07-01 10:15:38.7482+00', '2025-07-01 10:15:38.748259+00', '2025-07-01 10:15:38.748259+00', '3ee71de8-cb91-43bc-800a-b448db23d64d');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag") VALUES
	('32cb4242-375f-4e98-ac0d-eba630c45a4c', 'bf2ae210-4548-4aaa-9468-18d7c4e1e542', '2025-06-30 14:42:42.552306+00', '2025-06-30 14:42:42.552306+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '187.21.173.143', NULL),
	('c34feb34-ede5-4ce4-b480-9b068a12812a', '4e931881-dc42-43f9-8da1-65b051d1819a', '2025-06-30 14:42:44.814897+00', '2025-06-30 14:42:44.814897+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '187.21.173.143', NULL),
	('993d1c80-6d0b-4f52-afb9-df75deb8fe18', '698ff8cf-c9f7-4106-a23f-bbcd98b55d4d', '2025-06-30 14:43:11.748194+00', '2025-06-30 14:43:11.748194+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '187.21.173.143', NULL),
	('44ec2d2a-6e13-4381-83e0-27849ed53205', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-04 08:36:22.239376+00', '2025-07-04 08:36:22.239376+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0', '93.108.92.76', NULL),
	('83512198-768c-4aac-ab60-95bcca96caf1', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-03 15:06:23.516393+00', '2025-07-04 12:35:12.570365+00', NULL, 'aal1', NULL, '2025-07-04 12:35:12.570286', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '93.108.92.76', NULL),
	('e0aef618-8405-4b8a-a619-5a6fa15d0afb', '89fb2f47-8781-417a-969c-66f4c2d285ac', '2025-06-30 19:26:45.890603+00', '2025-07-02 13:21:38.082711+00', NULL, 'aal1', NULL, '2025-07-02 13:21:38.082635', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0', '70.35.213.117', NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('32cb4242-375f-4e98-ac0d-eba630c45a4c', '2025-06-30 14:42:42.556376+00', '2025-06-30 14:42:42.556376+00', 'password', '300af964-d9ae-4740-9bdb-f0316d89a29f'),
	('c34feb34-ede5-4ce4-b480-9b068a12812a', '2025-06-30 14:42:44.817335+00', '2025-06-30 14:42:44.817335+00', 'password', 'a6ae76b1-257a-4711-b4df-cb6fd4c63d6b'),
	('993d1c80-6d0b-4f52-afb9-df75deb8fe18', '2025-06-30 14:43:11.750754+00', '2025-06-30 14:43:11.750754+00', 'password', 'db2038b9-ef31-45e1-8384-dcbed5fd07fc'),
	('e0aef618-8405-4b8a-a619-5a6fa15d0afb', '2025-06-30 19:26:45.907771+00', '2025-06-30 19:26:45.907771+00', 'password', '132b60db-7cd1-4a57-be15-143bb83fb363'),
	('83512198-768c-4aac-ab60-95bcca96caf1', '2025-07-03 15:06:23.52643+00', '2025-07-03 15:06:23.52643+00', 'password', '0e5966c2-af59-4024-ba15-fdb3c24b48f3'),
	('44ec2d2a-6e13-4381-83e0-27849ed53205', '2025-07-04 08:36:22.255333+00', '2025-07-04 08:36:22.255333+00', 'password', '03c91757-6d48-4782-b776-cd5c1f0b4185');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 2152, 'eov6i67uz3rr', 'bf2ae210-4548-4aaa-9468-18d7c4e1e542', false, '2025-06-30 14:42:42.554568+00', '2025-06-30 14:42:42.554568+00', NULL, '32cb4242-375f-4e98-ac0d-eba630c45a4c'),
	('00000000-0000-0000-0000-000000000000', 2153, 'nxcpzn6w2drg', '4e931881-dc42-43f9-8da1-65b051d1819a', false, '2025-06-30 14:42:44.815533+00', '2025-06-30 14:42:44.815533+00', NULL, 'c34feb34-ede5-4ce4-b480-9b068a12812a'),
	('00000000-0000-0000-0000-000000000000', 2154, 'kg5kermndtp6', '698ff8cf-c9f7-4106-a23f-bbcd98b55d4d', false, '2025-06-30 14:43:11.749649+00', '2025-06-30 14:43:11.749649+00', NULL, '993d1c80-6d0b-4f52-afb9-df75deb8fe18'),
	('00000000-0000-0000-0000-000000000000', 2223, 'wkqoat2acbcb', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', true, '2025-07-03 16:04:53.396127+00', '2025-07-04 08:01:40.09892+00', 'gcbr3ewbs4ce', '83512198-768c-4aac-ab60-95bcca96caf1'),
	('00000000-0000-0000-0000-000000000000', 2225, '5jejzimi7bud', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', false, '2025-07-04 08:36:22.251742+00', '2025-07-04 08:36:22.251742+00', NULL, '44ec2d2a-6e13-4381-83e0-27849ed53205'),
	('00000000-0000-0000-0000-000000000000', 2224, 'gyt7tepnwvoq', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', true, '2025-07-04 08:01:40.125168+00', '2025-07-04 10:36:52.669134+00', 'wkqoat2acbcb', '83512198-768c-4aac-ab60-95bcca96caf1'),
	('00000000-0000-0000-0000-000000000000', 2180, 'ch3mvyqktdar', '89fb2f47-8781-417a-969c-66f4c2d285ac', true, '2025-06-30 19:26:45.896756+00', '2025-07-02 13:21:38.074795+00', NULL, 'e0aef618-8405-4b8a-a619-5a6fa15d0afb'),
	('00000000-0000-0000-0000-000000000000', 2199, 'xhrkraeev36x', '89fb2f47-8781-417a-969c-66f4c2d285ac', false, '2025-07-02 13:21:38.077141+00', '2025-07-02 13:21:38.077141+00', 'ch3mvyqktdar', 'e0aef618-8405-4b8a-a619-5a6fa15d0afb'),
	('00000000-0000-0000-0000-000000000000', 2226, 'rinzisxuhszu', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', true, '2025-07-04 10:36:52.672662+00', '2025-07-04 11:36:12.569259+00', 'gyt7tepnwvoq', '83512198-768c-4aac-ab60-95bcca96caf1'),
	('00000000-0000-0000-0000-000000000000', 2227, '3xlinlmpdgmy', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', true, '2025-07-04 11:36:12.57336+00', '2025-07-04 12:35:12.562681+00', 'rinzisxuhszu', '83512198-768c-4aac-ab60-95bcca96caf1'),
	('00000000-0000-0000-0000-000000000000', 2228, 'jy5sndnu5a2n', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', false, '2025-07-04 12:35:12.563934+00', '2025-07-04 12:35:12.563934+00', '3xlinlmpdgmy', '83512198-768c-4aac-ab60-95bcca96caf1'),
	('00000000-0000-0000-0000-000000000000', 2222, 'gcbr3ewbs4ce', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', true, '2025-07-03 15:06:23.522361+00', '2025-07-03 16:04:53.38953+00', NULL, '83512198-768c-4aac-ab60-95bcca96caf1');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: business_hours; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."business_hours" ("id", "day_of_week", "start_time", "end_time", "is_working_day", "created_at", "updated_at") VALUES
	('1a8f22ef-6cdf-4d77-87e4-261a6f31cfd7', 1, '09:00:00', '18:00:00', true, '2025-07-02 20:38:23.346903+00', '2025-07-02 20:38:23.346903+00'),
	('c8f474d3-3bda-425e-8e55-ef6b3a34661c', 2, '09:00:00', '18:00:00', true, '2025-07-02 20:38:23.346903+00', '2025-07-02 20:38:23.346903+00'),
	('b2747bc0-b2b5-409b-8ec7-b94f7d2e53cf', 3, '09:00:00', '18:00:00', true, '2025-07-02 20:38:23.346903+00', '2025-07-02 20:38:23.346903+00'),
	('67ff68ac-a85d-4d61-adc4-cf80d73b198e', 4, '09:00:00', '18:00:00', true, '2025-07-02 20:38:23.346903+00', '2025-07-02 20:38:23.346903+00'),
	('515c531b-0444-4c50-92ad-0167cf47cc00', 5, '09:00:00', '18:00:00', true, '2025-07-02 20:38:23.346903+00', '2025-07-02 20:38:23.346903+00'),
	('05db62b1-4a83-494f-be02-e98a63e6799a', 6, '00:00:00', '00:00:00', false, '2025-07-02 20:38:23.346903+00', '2025-07-02 20:38:23.346903+00'),
	('0410b236-c39b-49d8-afa8-15d273f38ebc', 0, '00:00:00', '00:00:00', false, '2025-07-02 20:38:23.346903+00', '2025-07-02 20:38:23.346903+00');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."categories" ("id", "name", "description", "color", "created_at", "updated_at", "sort_order", "icon", "is_enabled", "dynamic_form_schema") VALUES
	('29657f6c-c866-4d64-aeac-4bbdb027da70', 'Users & Passwords', 'User management and authentication', '#3B82F6', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00', 1, '👤', true, NULL),
	('d983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'IT & Technical Support', 'Information Technology and technical issues', '#3b82f6', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00', 1, 'monitor', true, NULL),
	('0c54e701-ddaa-414f-82fa-c0f067d29945', 'Facilities', 'Office facilities and infrastructure', '#10b981', '2025-06-30 14:13:13.126381+00', '2025-07-02 20:36:03.333707+00', 2, 'building', false, NULL),
	('00b2b615-6ea5-4e79-81f9-3387ddac10e8', 'ERP', 'Enterprise Resource Planning systems', '#F59E0B', '2025-06-26 23:46:45.313394+00', '2025-07-02 20:36:06.83799+00', 2, '📊', false, NULL),
	('db4b194a-afc9-45e0-8dd6-0ffc81079e97', 'Human Resources', 'HR related requests and issues', '#f59e0b', '2025-06-30 14:13:13.126381+00', '2025-07-02 20:36:07.774201+00', 3, 'users', false, NULL),
	('60a2f0b7-d005-4ddb-af34-6a8600c0299f', 'Infrastructure & Hardware', 'Hardware and infrastructure support', '#EF4444', '2025-06-26 23:46:45.313394+00', '2025-07-02 20:36:08.674316+00', 3, '🖥️', false, NULL),
	('9a624cbf-31f3-4a2c-a280-8031ab70bf1b', 'Operations', 'Operational and process related issues', '#8b5cf6', '2025-06-30 14:13:13.126381+00', '2025-07-02 20:36:09.43173+00', 5, 'settings', false, NULL),
	('74156158-6112-4c16-95b7-8dd956aec039', 'Other', 'General support and miscellaneous', '#8B5CF6', '2025-06-26 23:46:45.313394+00', '2025-07-02 20:36:10.223403+00', 4, '❓', false, NULL),
	('c7143bd0-8768-4cc6-9b66-28e547acb689', 'Finance', 'Financial and accounting requests', '#ef4444', '2025-06-30 14:13:13.126381+00', '2025-07-02 20:36:11.387166+00', 4, 'dollar-sign', false, NULL),
	('920f8946-1187-42a5-b8e5-d58018bbc680', 'Website & Intranet', 'Web-related support and issues', '#10B981', '2025-06-26 23:46:45.313394+00', '2025-07-02 20:36:12.780048+00', 5, '🌐', false, NULL),
	('aaefa368-9ba8-4804-9ef7-184827d06ef2', 'Office 365 & SharePoint', 'Microsoft Office 365 suite support', '#F97316', '2025-06-26 23:46:45.313394+00', '2025-07-02 20:36:13.513668+00', 6, '📧', false, NULL);


--
-- Data for Name: subcategories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."subcategories" ("id", "category_id", "name", "description", "sort_order", "response_time_hours", "resolution_time_hours", "specialized_agents", "created_at", "updated_at") VALUES
	('61a30439-5a58-4e36-876a-584e34d2edab', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Bug Report', 'Software bugs and system errors', 1, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('955fe8ad-6570-4584-a146-998b9d0e91a0', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Feature Request', 'New feature requests and enhancements', 2, 72, 168, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('1ec19a82-8375-4179-8038-ca377cd82738', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Account Issues', 'User account problems and access issues', 3, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('6b63644c-91b3-4d97-b5ae-f4228938e82e', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Hardware - Desktop/Workstation', 'Desktop computers and workstation issues', 11, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('89386bd5-8e84-4c7c-9cae-b36967b1bbef', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Hardware - Laptop', 'Laptop computers and portable devices', 12, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('96295e59-82ab-4c92-8648-32e4837e5b0d', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Hardware - Server', 'Server hardware and infrastructure', 13, 1, 8, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('60f5ba32-34d4-4a47-a646-4956c08aa88b', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Hardware - Printer/Scanner', 'Printing and scanning devices', 14, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('3dc1fa13-c9a0-47d0-a58a-5fe434306be8', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Hardware - Mobile Device', 'Smartphones and tablets', 15, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('5731bc00-fe2b-428c-ac0f-30ee6b5fcc77', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Hardware - Peripherals', 'Keyboard, mouse, monitor, accessories', 16, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('b66dd4d9-9226-4164-980f-a59c787cd4fc', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Hardware - Specialized', 'IoT devices, kiosks, unusual hardware', 17, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('2a5cde2d-274f-42a6-965e-68b6611059b2', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Software - Operating System', 'OS installation, updates, performance', 21, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('5100412d-446d-4728-b15f-9445e04d387b', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Software - Productivity Apps', 'Office suite, productivity software', 22, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('769c4e68-9874-4b5a-bca7-87bb46781f49', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Software - Corporate Apps', 'ERP, CRM, business applications', 23, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('0c33cfff-04a5-4900-90ae-f1daacc060f2', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Software - Browsers & Plugins', 'Web browsers and extensions', 24, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('a4990ed2-9298-4490-bbd3-8550d6a43873', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Software - Licensing', 'Software licenses and activation', 25, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('d2ed5ad1-60f9-4ab6-ba9b-a9460fec64ba', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Software - Security', 'Antivirus, patches, security updates', 26, 2, 12, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('6d5c1471-b579-44d2-a119-b5bcd9c53821', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Network - Connectivity', 'Wi-Fi, Ethernet connectivity issues', 31, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('fec15293-c185-4a7e-80ce-c2a295a2a40d', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Network - VPN & Remote Access', 'VPN connections and remote work', 32, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('c498d08a-2c9f-40b1-b03c-9cb88d3fdb0f', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Network - Performance', 'Network speed and performance issues', 33, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('614a2975-b0a1-4458-922e-77e2cfe0a577', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Network - Security', 'Firewall and network security', 34, 2, 12, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('7d95f80d-4e5d-43cb-bfaf-50fe3aebe97a', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Network - Infrastructure', 'Switches, routers, access points', 35, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('a017ee61-cb74-44f2-8428-cf85b9be47a3', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Network - Outages', 'Network failures and outages', 36, 1, 4, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('368f9c9a-4726-4400-aee0-a5e407caa1ef', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Storage & Backup', 'File storage and backup systems', 41, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('cdb34a8c-61dc-4faa-ba12-ed5ce26ab1b1', '29657f6c-c866-4d64-aeac-4bbdb027da70', '[Germany] New Employee Onboarding', 'Onboarding process for new employees in Germany', 1, 24, 48, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('adf041c5-34fd-4cc0-ac35-c12944997975', '29657f6c-c866-4d64-aeac-4bbdb027da70', '[Rest of Europe] Onboard new employees', 'Onboarding process for new employees in other European countries', 2, 24, 48, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('ab300583-5e93-4c1a-9246-426159a3f8e9', '29657f6c-c866-4d64-aeac-4bbdb027da70', 'Employee offboarding', 'Process for departing employees', 3, 8, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('4924a48f-159d-46f3-9afd-775e147f3d05', '29657f6c-c866-4d64-aeac-4bbdb027da70', 'Forgot my password', 'Password reset requests', 4, 2, 4, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('48efdd04-5d48-4c73-b806-bae52d2197bf', '29657f6c-c866-4d64-aeac-4bbdb027da70', 'Multi factor authentication', 'MFA setup and issues', 5, 4, 8, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('c16faefe-9557-4e6a-bfa6-6ff58d7e81c2', '00b2b615-6ea5-4e79-81f9-3387ddac10e8', 'ERP Belgium', 'ERP system support for Belgium', 1, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('65ce455a-630b-4a08-89a0-8f646726e52e', '00b2b615-6ea5-4e79-81f9-3387ddac10e8', 'ERP Germany (Dynamics NAV)', 'Dynamics NAV support for Germany', 2, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('778fb183-a810-42f6-9fb0-7e7cc61fd663', '00b2b615-6ea5-4e79-81f9-3387ddac10e8', 'ERP Netherlands', 'ERP system support for Netherlands', 3, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('3c385e39-3144-4d0a-9b2b-5d503c703337', '00b2b615-6ea5-4e79-81f9-3387ddac10e8', 'ERP UK', 'ERP system support for UK', 4, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('9fec05c0-d275-4e1e-b3dd-abc922609acd', '00b2b615-6ea5-4e79-81f9-3387ddac10e8', 'SAP system', 'SAP system support', 5, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('b6f1b956-9c28-4b0d-a9c6-c54e13a372ba', '60a2f0b7-d005-4ddb-af34-6a8600c0299f', 'Get a guest wifi account', 'Guest WiFi access requests', 1, 2, 4, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('7c10eadd-ba32-4ba1-8d34-4cf3f7da0bae', '60a2f0b7-d005-4ddb-af34-6a8600c0299f', 'New mobile device', 'Mobile device requests and setup', 2, 8, 48, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('da0c0db5-79e2-4eee-a925-f37e6b2dfe2e', '60a2f0b7-d005-4ddb-af34-6a8600c0299f', 'Printer & Scanner', 'Printer and scanner support', 3, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('de9af1b9-8418-48b0-af85-5bb3943601a1', '60a2f0b7-d005-4ddb-af34-6a8600c0299f', 'Request new hardware', 'New hardware requests', 4, 24, 72, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('7caffbd8-931b-4381-a5db-5aac87c89437', '74156158-6112-4c16-95b7-8dd956aec039', 'Get IT help', 'General IT support requests', 1, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('9dd5990a-d826-414b-bbc1-409f65bd2b65', '920f8946-1187-42a5-b8e5-d58018bbc680', 'Intranet', 'Internal website support', 1, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('b5cfbbb4-23a1-45f0-87da-ebe7e0cb771b', '920f8946-1187-42a5-b8e5-d58018bbc680', 'Web shop / eCommerce', 'Online store support', 2, 2, 8, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('a536399a-a337-4697-888e-22d74c4efc33', '920f8946-1187-42a5-b8e5-d58018bbc680', 'Website issue', 'External website issues', 3, 2, 8, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('12d09773-3602-44e6-8324-f3777537e020', 'aaefa368-9ba8-4804-9ef7-184827d06ef2', 'Outlook', 'Email and calendar support', 1, 2, 8, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('9f48d3f1-a950-4de7-adfe-397e87086cee', 'aaefa368-9ba8-4804-9ef7-184827d06ef2', 'SharePoint issues & permissions', 'SharePoint access and issues', 2, 4, 24, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('d11386cd-baf8-4f75-a61a-be1e7f30e2aa', 'aaefa368-9ba8-4804-9ef7-184827d06ef2', 'Teams & OneDrive issues', 'Microsoft Teams and OneDrive support', 3, 2, 8, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('2774f38d-1e47-4fe6-8654-7661c259193b', 'aaefa368-9ba8-4804-9ef7-184827d06ef2', 'Word / Excel / PowerPoint issues', 'Office suite application support', 4, 2, 8, '{}', '2025-06-26 23:46:45.313394+00', '2025-06-26 23:46:45.313394+00'),
	('8355eab6-9133-4d61-9b46-e3d04b34e23f', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Storage - Recovery', 'Data recovery and restoration', 42, 2, 12, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('452244b9-6242-4aae-a485-ce1b12037872', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Storage - Sync & Share', 'File synchronization and sharing', 43, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('f28d62fc-beee-4696-99e3-bedc4f3434a7', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Storage - Cloud', 'OneDrive, SharePoint, cloud storage', 44, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('06770fd3-bbce-429e-b5b0-e4c316c1a4e6', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Identity & Access - Accounts', 'User account creation and deletion', 51, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('0f08e207-225a-4341-962c-4b0b13e2ffb0', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Identity & Access - Passwords', 'Password resets and changes', 52, 2, 8, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('1d5087c4-8754-4083-bd41-a9c686e1fe33', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Identity & Access - Permissions', 'Access permissions and groups', 53, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('b2b24dc2-f8e0-4ef1-8ef3-659e2241004e', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Identity & Access - MFA', 'Multi-factor authentication', 54, 4, 24, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('0ca018f0-9e15-43a0-b870-de1b80b38207', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Identity & Access - Directory', 'Active Directory, Azure AD integration', 55, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('72c65d22-d818-4044-a81a-5d88f5bc9f3d', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Services - Certificates', 'SSL certificates and licensing keys', 61, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('e32d0f58-5713-42ce-a79a-b9be086a3dd5', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Services - Cloud', 'Azure, AWS, M365 services', 62, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('db1142ac-87de-419a-8f42-63432ec3570d', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Services - Integrations', 'API integrations and connections', 63, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('bdcde942-7073-4b35-83de-330e4f19938a', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Services - Monitoring', 'System monitoring and alerts', 64, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('1c420547-70a5-4c1d-b7ac-650f5a526cf8', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Security - Vulnerabilities', 'Security patches and vulnerabilities', 71, 1, 4, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('13b7774c-290b-402b-8309-9149820543f6', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Security - Incidents', 'Security incidents and breaches', 72, 1, 2, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('c6e1b577-f2d7-4651-a342-04fecad3c499', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Security - Unauthorized Access', 'Unauthorized access attempts', 73, 1, 4, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('78c4aae6-6bf2-4c58-8ae3-c8ae2cabae78', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Security - Malware', 'Malware, ransomware, virus issues', 74, 1, 2, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('f981afd1-1699-44d1-a5c5-c5fdfbfcf603', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'Security - Audit', 'Security audits and log analysis', 75, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('978d83d2-51c1-43e8-b6dc-dd43b72eb138', '0c54e701-ddaa-414f-82fa-c0f067d29945', 'Office Equipment', 'Furniture, office equipment issues', 1, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('095e07a8-a089-4268-87fa-e93c1d3637db', '0c54e701-ddaa-414f-82fa-c0f067d29945', 'Building & Infrastructure', 'HVAC, lighting, building issues', 2, 8, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('c4de2a0d-5229-4f52-8195-4294ef86d9c0', '0c54e701-ddaa-414f-82fa-c0f067d29945', 'Cleaning & Maintenance', 'Cleaning and maintenance requests', 3, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('fc15c18e-deaa-4233-8a46-a09fcbf32f74', 'db4b194a-afc9-45e0-8dd6-0ffc81079e97', 'Employee Onboarding', 'New employee setup and onboarding', 1, 24, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('2547880b-a5b3-4eed-945f-b74e07ada830', 'db4b194a-afc9-45e0-8dd6-0ffc81079e97', 'Benefits & Payroll', 'Benefits, payroll, compensation', 2, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('2d6e54a2-627d-4e9f-8870-e84a091170a9', 'db4b194a-afc9-45e0-8dd6-0ffc81079e97', 'Training & Development', 'Training requests and development', 3, 72, 168, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('c93f3ce5-9fd8-4cc5-9dda-03b0484c89a7', 'c7143bd0-8768-4cc6-9b66-28e547acb689', 'Expense Reports', 'Expense reporting and reimbursement', 1, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('f5d60ac3-70a3-41ee-b036-70b662c06c4f', 'c7143bd0-8768-4cc6-9b66-28e547acb689', 'Procurement', 'Purchase requests and procurement', 2, 48, 168, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('b5ad466b-f42a-465b-893e-10e9c22f6ab7', 'c7143bd0-8768-4cc6-9b66-28e547acb689', 'Invoicing & Billing', 'Invoice and billing issues', 3, 24, 48, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('a663c9c6-ed53-4816-9cd9-66b8dd013aa6', '9a624cbf-31f3-4a2c-a280-8031ab70bf1b', 'Process Improvement', 'Process optimization requests', 1, 72, 336, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('6c819c3e-8445-4fca-8296-324ddc9e8854', '9a624cbf-31f3-4a2c-a280-8031ab70bf1b', 'Documentation', 'Documentation and procedure updates', 2, 48, 168, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('3123a4e6-a7c3-47c3-8189-17ab5d7fd61b', '9a624cbf-31f3-4a2c-a280-8031ab70bf1b', 'Quality Issues', 'Quality control and assurance', 3, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('7616533c-af8c-4c12-adaf-71b3d0452eec', '74156158-6112-4c16-95b7-8dd956aec039', 'General Inquiry', 'General questions and information', 1, 24, 72, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00'),
	('9c905a66-01aa-48b3-a0ff-9b0ebb972ec1', '74156158-6112-4c16-95b7-8dd956aec039', 'Suggestion', 'Suggestions and feedback', 2, 72, 168, '{}', '2025-06-30 14:13:13.126381+00', '2025-06-30 14:13:13.126381+00');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."users" ("id", "email", "full_name", "avatar_url", "role", "created_at", "updated_at", "temporary_password", "temporary_password_created_at", "temporary_password_expires_at", "must_change_password", "last_password_change", "agent_level") VALUES
	('07463184-ea33-49fc-ba13-109b9a29eb97', 'admin@analytichem.com', 'Admin AnalytiChem', NULL, 'admin', '2025-06-26 23:00:00.416+00', '2025-06-26 23:00:00.53017+00', NULL, NULL, NULL, false, NULL, NULL),
	('5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'felipe.henrique@analytichem.com', 'Felipe dos Santos Henrique', 'https://plbmgjqitlxedsmdqpld.supabase.co/storage/v1/object/public/avatars/5ac2883b-68c6-4ebb-b960-9a4171c048fe/avatar-1750979685010.jpg', 'admin', '2025-06-26 22:50:14.089492+00', '2025-06-26 23:14:46.289376+00', NULL, NULL, NULL, false, NULL, NULL),
	('bf2ae210-4548-4aaa-9468-18d7c4e1e542', 'qa_1751294560374@example.com', 'QA Automação', NULL, 'user', '2025-06-30 14:42:42.509053+00', '2025-06-30 14:42:42.509053+00', NULL, NULL, NULL, false, NULL, NULL),
	('4e931881-dc42-43f9-8da1-65b051d1819a', 'qa@example.com', 'QA Automação', NULL, 'user', '2025-06-30 14:42:44.79733+00', '2025-06-30 14:42:44.79733+00', NULL, NULL, NULL, false, NULL, NULL),
	('698ff8cf-c9f7-4106-a23f-bbcd98b55d4d', 'qa_1751294589626@example.com', 'QA Automação', NULL, 'user', '2025-06-30 14:43:11.736137+00', '2025-06-30 14:43:11.736137+00', NULL, NULL, NULL, false, NULL, NULL),
	('d897b994-3a4a-46f6-889c-400973aad4b7', 'test.agent@contoso.com', 'User Test Account', NULL, 'user', '2025-07-01 10:15:38.730613+00', '2025-07-01 10:15:38.730613+00', NULL, NULL, NULL, false, NULL, NULL),
	('89fb2f47-8781-417a-969c-66f4c2d285ac', 'shravan.muchandi@analytichem.com', 'Shravan Muchandi', NULL, 'agent', '2025-06-30 19:26:45.831976+00', '2025-07-03 10:48:51.797465+00', NULL, NULL, NULL, false, NULL, NULL);


--
-- Data for Name: tickets_new; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."tickets_new" ("id", "ticket_number", "title", "description", "status", "priority", "category_id", "user_id", "assigned_to", "resolution", "resolved_at", "resolved_by", "closed_at", "closed_by", "created_at", "updated_at", "feedback_received", "reopen_reason", "reopened_at", "reopened_by", "subcategory_id", "creator_id", "attached_form", "attachments", "business_phone", "mobile_phone", "start_date", "signature_group", "usage_location", "country_distribution_list", "license_type", "mfa_setup", "company_name", "first_name", "last_name", "username", "display_name", "job_title", "manager", "department", "office_location", "first_response_at", "first_response_by", "sla_paused_at", "sla_pause_reason", "total_pause_duration", "sla_response_due", "sla_resolution_due", "sla_response_met", "sla_resolution_met") VALUES
	('f44c661a-8dae-4ba2-8b3f-87552fae51f9', 'ACS-TK-202507-0004', 'Eset license problem', 'Eset license problem', 'closed', 'high', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'fechado.', '2025-07-02 19:10:45.114+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-03 14:13:48.312+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 13:09:38.236+00', '2025-07-03 14:13:48.446376+00', true, 'teste', '2025-07-02 14:35:23.645+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'd2ed5ad1-60f9-4ab6-ba9b-a9460fec64ba', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2025-07-02 15:09:38.236+00', '2025-07-02 21:09:38.236+00', NULL, false),
	('62fc1e1c-1889-405c-bd8e-4de2c2b41916', 'ACS-TK-202507-0003', 'Test labels issue', 'Test labels issue', 'resolved', 'high', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'd897b994-3a4a-46f6-889c-400973aad4b7', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', '2025-07-04 08:39:41.389+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', NULL, NULL, '2025-07-01 16:02:47.59+00', '2025-07-04 08:39:41.806597+00', false, NULL, NULL, NULL, '61a30439-5a58-4e36-876a-584e34d2edab', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, '2025-07-01 18:02:47.59+00', '2025-07-02 00:02:47.59+00', NULL, false),
	('341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', 'ACS-TK-202507-0002', 'ESET Security not Activated - Joanne Scalzitti', 'ESET Security not Activated - Joanne Scalzitti', 'closed', 'high', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'd897b994-3a4a-46f6-889c-400973aad4b7', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Test closure.', '2025-07-01 15:25:26.18+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-01 15:58:47.78+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-01 14:43:21.161+00', '2025-07-01 15:58:47.916019+00', false, NULL, NULL, NULL, '614a2975-b0a1-4458-922e-77e2cfe0a577', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
	('e4178b50-3617-4a7a-b9ec-ebdf5dfff523', 'ACS-TK-202507-0007', 'teste', 'teste', 'open', 'medium', '0c54e701-ddaa-414f-82fa-c0f067d29945', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', NULL, NULL, NULL, NULL, NULL, NULL, '2025-07-02 14:28:57.749+00', '2025-07-02 14:28:57.749+00', false, NULL, NULL, NULL, '978d83d2-51c1-43e8-b6dc-dd43b72eb138', NULL, NULL, '[]', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
	('21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', 'ACS-TK-202507-0005', 'Eset license problem', 'Eset license problem', 'closed', 'high', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', 'd897b994-3a4a-46f6-889c-400973aad4b7', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Resolvido', '2025-07-02 19:00:03.595+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 19:00:21.314+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 13:10:12.943+00', '2025-07-02 19:00:21.996655+00', false, 'teste', '2025-07-02 14:29:13.541+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'd2ed5ad1-60f9-4ab6-ba9b-a9460fec64ba', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
	('6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', 'ACS-TK-202507-0001', 'Endpoint Antivirus - Activation Alert', 'ESET Security not activated', 'closed', 'medium', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Test closure.', '2025-07-01 15:37:14.894+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 19:02:06.671+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-01 09:47:21.769+00', '2025-07-02 19:02:07.371079+00', false, NULL, NULL, NULL, 'd2ed5ad1-60f9-4ab6-ba9b-a9460fec64ba', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
	('9eb13a9a-a451-4611-ac78-bad3a03bfa32', 'ACS-TK-202506-0001', 'Test SLA Track Feature', 'teste teste', 'closed', 'urgent', '29657f6c-c866-4d64-aeac-4bbdb027da70', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', '2025-07-01 15:57:33.898+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 19:09:29.224+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-06-30 08:23:12.565+00', '2025-07-02 19:09:29.913712+00', true, NULL, NULL, NULL, 'ab300583-5e93-4c1a-9246-426159a3f8e9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL),
	('3ffd597b-e568-491f-9dc3-e844d2ad9f50', 'ACS-TK-202507-0006', 'Outlook Data File Crash ', 'Outlook Data File Crash ', 'open', 'medium', 'd983b9b0-f4f9-46ab-8461-b83f7b6f695d', '89fb2f47-8781-417a-969c-66f4c2d285ac', '89fb2f47-8781-417a-969c-66f4c2d285ac', NULL, NULL, NULL, NULL, NULL, '2025-07-02 13:44:22.833+00', '2025-07-03 10:50:48.198101+00', false, NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL);


--
-- Data for Name: ticket_chats; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_chats" ("id", "ticket_id", "created_at", "updated_at", "is_active", "is_disabled", "disabled_reason", "chat_type") VALUES
	('02ce007a-f784-42d0-9f5e-0cab4e5f9a66', '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 14:43:21.296759+00', '2025-07-01 15:22:10.033703+00', true, true, 'Ticket resolved', 'ticket'),
	('76505b6f-6e40-4db8-a125-7ed4e0d8e353', '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 10:04:03.307169+00', '2025-07-01 15:26:06.165064+00', true, true, 'Ticket resolved', 'ticket'),
	('e6c474ec-1b27-41dd-a7f0-8644bcf357e2', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-06-30 08:23:13.088732+00', '2025-07-01 15:57:34.044425+00', true, true, 'Ticket resolved', 'ticket'),
	('e46cc48f-cb0e-4093-a6be-9a2777911200', '3ffd597b-e568-491f-9dc3-e844d2ad9f50', '2025-07-02 13:44:23.045338+00', '2025-07-02 13:44:23.045338+00', true, false, NULL, 'ticket'),
	('7c299e42-8ea3-429e-9109-4e1c600e899e', 'e4178b50-3617-4a7a-b9ec-ebdf5dfff523', '2025-07-02 14:28:57.865796+00', '2025-07-02 14:28:57.865796+00', true, false, NULL, 'ticket'),
	('ad2f0105-f98f-4b8f-91fa-7f7843a734d1', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:02:47.726759+00', '2025-07-02 18:59:47.446305+00', true, false, NULL, 'ticket'),
	('ff8f3f48-e83f-44aa-99ea-8283b09564a1', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:10:13.204386+00', '2025-07-02 19:00:04.273468+00', true, true, 'Ticket resolved', 'ticket'),
	('f02b66a5-1828-4164-b17a-fcd9eca8cb4f', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:09:38.458647+00', '2025-07-03 14:13:48.446376+00', false, true, 'Ticket resolved', 'ticket');


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."chat_messages" ("id", "chat_id", "sender_id", "content", "file_path", "file_name", "file_size", "mime_type", "is_read", "is_internal", "message_type", "created_at", "updated_at", "chat_type", "is_moderated", "moderated_by", "moderated_at", "edit_deadline") VALUES
	('675e196b-56f2-4c5f-b14c-9dd6ff8eedd0', 'e6c474ec-1b27-41dd-a7f0-8644bcf357e2', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', NULL, NULL, NULL, NULL, false, false, 'text', '2025-06-30 13:43:27.09994+00', '2025-06-30 13:43:27.09994+00', 'ticket', false, NULL, NULL, '2025-06-30 13:45:27.09994+00'),
	('04b430c7-a85e-4544-a792-f449cca5d531', 'e6c474ec-1b27-41dd-a7f0-8644bcf357e2', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', NULL, NULL, NULL, NULL, false, false, 'text', '2025-06-30 17:01:05.692445+00', '2025-06-30 17:01:05.692445+00', 'ticket', false, NULL, NULL, '2025-06-30 17:03:05.692445+00'),
	('d279cdce-f946-4195-ae85-d9748c30d29a', 'e6c474ec-1b27-41dd-a7f0-8644bcf357e2', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Teste para mensagens mobile', NULL, NULL, NULL, NULL, false, false, 'text', '2025-07-01 09:01:49.367367+00', '2025-07-01 09:01:49.367367+00', 'ticket', false, NULL, NULL, '2025-07-01 09:03:49.367367+00'),
	('88c2bea4-04cf-490b-a1f7-019001b2f666', '76505b6f-6e40-4db8-a125-7ed4e0d8e353', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', NULL, NULL, NULL, NULL, false, false, 'text', '2025-07-01 10:07:53.717706+00', '2025-07-01 10:07:53.717706+00', 'ticket', false, NULL, NULL, '2025-07-01 10:09:53.717706+00'),
	('f8583100-8b5f-4dd3-a49c-f9293a4b7ba3', '02ce007a-f784-42d0-9f5e-0cab4e5f9a66', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Removed ESET from pc and onboarded the device.', NULL, NULL, NULL, NULL, false, false, 'text', '2025-07-01 14:49:59.207425+00', '2025-07-01 14:49:59.207425+00', 'ticket', false, NULL, NULL, '2025-07-01 14:51:59.207425+00'),
	('62c2c31a-0067-4ab3-a244-858ae1f6a4de', '02ce007a-f784-42d0-9f5e-0cab4e5f9a66', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', NULL, NULL, NULL, NULL, false, false, 'text', '2025-07-01 14:51:47.577936+00', '2025-07-01 14:51:47.577936+00', 'ticket', false, NULL, NULL, '2025-07-01 14:53:47.577936+00'),
	('57d316b0-e901-46c3-a962-9f698704ba8a', 'ad2f0105-f98f-4b8f-91fa-7f7843a734d1', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'hello', NULL, NULL, NULL, NULL, false, false, 'text', '2025-07-01 16:02:57.860913+00', '2025-07-01 16:02:57.860913+00', 'ticket', false, NULL, NULL, '2025-07-01 16:04:57.860913+00'),
	('bfc029d9-0fde-4e12-9aad-ddeeb5ef56f2', 'ff8f3f48-e83f-44aa-99ea-8283b09564a1', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'TESTE', NULL, NULL, NULL, NULL, false, false, 'text', '2025-07-02 13:10:46.668589+00', '2025-07-02 13:10:46.668589+00', 'ticket', false, NULL, NULL, '2025-07-02 13:12:46.668589+00');


--
-- Data for Name: chat_message_mentions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_message_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: chat_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."chat_participants" ("id", "chat_id", "user_id", "joined_at", "last_read_at", "can_write", "is_silenced", "silenced_until", "silenced_by") VALUES
	('473237aa-36d5-4156-a202-85d33aefecde', 'f02b66a5-1828-4164-b17a-fcd9eca8cb4f', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-04 08:01:41.121+00', '2025-07-04 08:01:41.121+00', true, false, NULL, NULL),
	('92711751-5111-43dd-811e-914eee1f8aad', '76505b6f-6e40-4db8-a125-7ed4e0d8e353', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-01 10:07:50.105+00', '2025-07-01 10:07:50.105+00', true, false, NULL, NULL),
	('8a8683a7-08d6-4159-8a98-2edb51195eb1', 'e6c474ec-1b27-41dd-a7f0-8644bcf357e2', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-01 14:11:06.942+00', '2025-07-01 14:11:06.942+00', true, false, NULL, NULL),
	('57ed4616-6c59-45ac-a721-d1198f65e196', '02ce007a-f784-42d0-9f5e-0cab4e5f9a66', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-01 14:51:24.294+00', '2025-07-01 14:51:24.294+00', true, false, NULL, NULL),
	('d909a09c-d1e7-4b10-9239-e75a29497dac', 'ad2f0105-f98f-4b8f-91fa-7f7843a734d1', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 13:05:25.84+00', '2025-07-02 13:05:25.84+00', true, false, NULL, NULL),
	('9ea0b604-ff98-4c4d-8b48-b49ef176d732', 'ff8f3f48-e83f-44aa-99ea-8283b09564a1', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 13:11:11.31+00', '2025-07-02 13:11:11.31+00', true, false, NULL, NULL),
	('05b1af1b-f2de-45ef-8997-89a368e6bbca', 'e46cc48f-cb0e-4093-a6be-9a2777911200', '89fb2f47-8781-417a-969c-66f4c2d285ac', '2025-07-02 13:44:23.045338+00', NULL, true, false, NULL, NULL),
	('b6abc5c5-2ea7-4132-82dc-d5d22209f3a4', 'e46cc48f-cb0e-4093-a6be-9a2777911200', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 18:59:17.779+00', '2025-07-02 18:59:17.779+00', true, false, NULL, NULL),
	('bc11ec93-b8ae-490d-b490-eabf6a66d611', '7c299e42-8ea3-429e-9109-4e1c600e899e', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-03 10:41:56.072+00', '2025-07-03 10:41:56.072+00', true, false, NULL, NULL);


--
-- Data for Name: debug_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: direct_chats; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: knowledge_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."knowledge_categories" ("id", "name", "slug", "description", "color", "icon", "sort_order", "is_active", "created_at", "updated_at", "parent_id") VALUES
	('6c37bae0-9bd2-448e-9d9b-2f1775a1d980', 'Getting Started', 'getting-started', 'Basic guides and tutorials', '#3B82F6', 'Rocket', 1, true, '2025-06-30 08:43:03.171536+00', '2025-06-30 08:43:03.171536+00', NULL),
	('3d68c035-30df-4e1d-ab04-6c9b5f49bbe1', 'Technical Support', 'technical-support', 'Technical troubleshooting guides', '#EF4444', 'Settings', 2, true, '2025-06-30 08:43:03.171536+00', '2025-06-30 08:43:03.171536+00', NULL),
	('5e713602-0719-4a0c-8ec3-12cc4a04aa48', 'Account Management', 'account-management', 'Account and user management guides', '#10B981', 'User', 3, true, '2025-06-30 08:43:03.171536+00', '2025-06-30 08:43:03.171536+00', NULL),
	('a0379d91-b4ec-434a-b4c0-73aad116012f', 'Billing & Payments', 'billing-payments', 'Billing and payment information', '#F59E0B', 'CreditCard', 4, true, '2025-06-30 08:43:03.171536+00', '2025-06-30 08:43:03.171536+00', NULL),
	('69eb6c3b-0990-44b1-83ce-d7aff99f869e', 'FAQ', 'faq', 'Common questions and answers', '#8B5CF6', 'HelpCircle', 5, true, '2025-06-30 08:43:03.171536+00', '2025-06-30 08:43:03.171536+00', NULL);


--
-- Data for Name: knowledge_articles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."knowledge_articles" ("id", "title", "slug", "content", "excerpt", "status", "featured", "view_count", "helpful_count", "not_helpful_count", "tags", "meta_title", "meta_description", "author_id", "knowledge_category_id", "category_id", "sort_order", "published_at", "created_at", "updated_at", "reading_time_minutes", "version") VALUES
	('f049742c-18bb-4a10-8ca3-03c30e34d608', 'dasdasdas', 'dasdasdas', '🔐 Reset Your Password
If you''ve forgotten your password or need to reset it for security reasons, our ticketing system offers a simple and secure way to request a reset. Follow the step-by-step guide below to ensure your request is processed quickly and correctly.

🧭 Step-by-Step Guide
1. Log into the Ticket Portal
Navigate to the internal support portal and sign in using your usual credentials.

Can’t access? Ask your manager or IT to open the ticket for you.

2. Create a New Ticket
Click the “New Ticket” button in the top-right corner of your dashboard.

3. Choose the Appropriate Category
Select:

Category: Users & Passwords

Subcategory: Forgot my password

✅ This ensures your ticket is routed to the correct support team.

4. Fill In Ticket Details
You’ll be prompted to provide:

Summary: e.g., “Password Reset Request”

Start Date: Optional

Description: Briefly explain the issue
e.g., “I cannot log in. I believe my password was changed.”

Attachments: (Optional, e.g., screenshot of error)

5. Submit the Ticket
Click “Submit”. Your request will be queued for IT review.

6. Agent Assignment & Follow-up
A support agent will be assigned and may reach out via internal chat.

🗨️ Only agents can initiate chat.

Check your ticket status regularly for updates.

7. Password Reset
After verifying your identity, the agent will reset your password and provide temporary credentials through:

The ticket comments section, or

A secure email (depending on policy)

You''ll then be prompted to set a new password on your next login.

8. Close the Ticket & Give Feedback
Once your issue is resolved, the ticket will be marked as Closed.
You may be asked to rate your support experience.

🔐 Security Reminder
Passwords are never sent in plain text.

All reset actions are logged.

You should change your password immediately after logging in.

❓ Need Help?
If you’re unable to access the portal at all, contact IT directly via phone or email for urgent reset requests.', 'dasdasdasdas', 'published', false, 0, 0, 0, '{}', NULL, '', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '3d68c035-30df-4e1d-ab04-6c9b5f49bbe1', NULL, 0, NULL, '2025-07-02 21:19:40.677+00', '2025-07-02 21:19:40.677+00', 2, 1),
	('c54718b1-75f6-4b26-8b2e-0da608428dd0', 'asdasdasdads', 'asdasdasdads', '🔐 Reset Your Password
If you''ve forgotten your password or need to reset it for security reasons, our ticketing system offers a simple and secure way to request a reset. Follow the step-by-step guide below to ensure your request is processed quickly and correctly.

🧭 Step-by-Step Guide
1. Log into the Ticket Portal
Navigate to the internal support portal and sign in using your usual credentials.

Can’t access? Ask your manager or IT to open the ticket for you.

2. Create a New Ticket
Click the “New Ticket” button in the top-right corner of your dashboard.

3. Choose the Appropriate Category
Select:

Category: Users & Passwords

Subcategory: Forgot my password

✅ This ensures your ticket is routed to the correct support team.

4. Fill In Ticket Details
You’ll be prompted to provide:

Summary: e.g., “Password Reset Request”

Start Date: Optional

Description: Briefly explain the issue
e.g., “I cannot log in. I believe my password was changed.”

Attachments: (Optional, e.g., screenshot of error)

5. Submit the Ticket
Click “Submit”. Your request will be queued for IT review.

6. Agent Assignment & Follow-up
A support agent will be assigned and may reach out via internal chat.

🗨️ Only agents can initiate chat.

Check your ticket status regularly for updates.

7. Password Reset
After verifying your identity, the agent will reset your password and provide temporary credentials through:

The ticket comments section, or

A secure email (depending on policy)

You''ll then be prompted to set a new password on your next login.

8. Close the Ticket & Give Feedback
Once your issue is resolved, the ticket will be marked as Closed.
You may be asked to rate your support experience.

🔐 Security Reminder
Passwords are never sent in plain text.

All reset actions are logged.

You should change your password immediately after logging in.

❓ Need Help?
If you’re unable to access the portal at all, contact IT directly via phone or email for urgent reset requests.', 'asdasdasdas', 'draft', false, 0, 0, 0, '{}', NULL, '', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '6c37bae0-9bd2-448e-9d9b-2f1775a1d980', NULL, 0, NULL, '2025-07-02 21:19:51.236+00', '2025-07-02 21:19:51.236+00', 2, 1);


--
-- Data for Name: knowledge_article_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: knowledge_article_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: knowledge_article_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notifications" ("id", "user_id", "type", "title", "message", "priority", "read", "ticket_id", "created_at", "updated_at") VALUES
	('15ddf28b-029f-43ad-87bc-cf665c96a98f', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202506-0001', 'Novo ticket criado: "Test SLA Track Feature" por Felipe dos Santos Henrique', 'medium', false, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-06-30 08:23:13.431913+00', '2025-06-30 08:23:13.431913+00'),
	('7b5ecbea-df0d-452d-b507-dad17c025e71', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202506-0001', 'Novo ticket criado: "Test SLA Track Feature" por Felipe dos Santos Henrique', 'medium', true, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-06-30 08:23:13.431913+00', '2025-06-30 10:07:28.804571+00'),
	('5781fc7c-a326-4ab3-ace9-9074084870a9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'comment_added', 'Novo Comentário: ACS-TK-202506-0001', 'Novo comentário adicionado ao seu ticket "Test SLA Track Feature"', 'medium', true, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-06-30 14:01:54.795772+00', '2025-06-30 15:23:44.429286+00'),
	('3315de2e-bd53-4513-8688-d91ed8b6c28d', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'task_assigned', 'New Task Assigned', 'You have been assigned a new task: "teste" on ticket #ACS-TK-202506-0001', 'medium', true, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-06-30 14:30:58.827429+00', '2025-06-30 15:23:44.429286+00'),
	('bd758752-3b5e-4f74-a36d-e4b567fe4553', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0001', 'Novo ticket criado: "Endpoint Antivirus - Activation Alert" por Felipe dos Santos Henrique', 'medium', false, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 09:47:22.66813+00', '2025-07-01 09:47:22.66813+00'),
	('ca57d62d-9787-4ac6-b64f-c875364bf451', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0001', 'Novo ticket criado: "Endpoint Antivirus - Activation Alert" por Felipe dos Santos Henrique', 'medium', false, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 09:47:22.66813+00', '2025-07-01 09:47:22.66813+00'),
	('bf60f442-e2c8-4437-9a55-c27c9467e5de', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0001', 'Novo ticket criado: "Endpoint Antivirus - Activation Alert" por Felipe dos Santos Henrique', 'medium', true, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 09:47:22.66813+00', '2025-07-01 09:59:53.727006+00'),
	('a52def3a-ea4c-4c89-b4d7-20dc44c4b0d2', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0002', 'Novo ticket criado: "ESET Security not Activated - Joanne Scalzitti" por User Test Account', 'medium', false, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 14:43:21.59479+00', '2025-07-01 14:43:21.59479+00'),
	('bf4738e5-e1f6-4cc5-9903-ee0bc32e00fc', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0002', 'Novo ticket criado: "ESET Security not Activated - Joanne Scalzitti" por User Test Account', 'medium', false, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 14:43:21.59479+00', '2025-07-01 14:43:21.59479+00'),
	('26f84ba4-b928-4461-840e-4886b3c70bb0', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'comment_added', '💬 Nova Mensagem Recebida', 'Você recebeu uma nova mensagem no chamado ACS-TK-202507-0002. Clique para ver a mensagem e continuar a conversa.', 'medium', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 14:49:59.659+00', '2025-07-01 14:50:48.978855+00'),
	('0b173929-b0bd-4054-96b2-741bce056c71', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202506-0001 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-07-01 15:57:34.275584+00', '2025-07-01 15:57:58.011592+00'),
	('6f3ca0d6-0a31-4786-8b36-3cab618541cb', '07463184-ea33-49fc-ba13-109b9a29eb97', 'feedback_received', 'Feedback Recebido', 'Foi recebida uma avaliação para o chamado ACS-TK-202506-0001. Clique para ver os detalhes.', 'low', false, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-07-01 15:58:01.855784+00', '2025-07-01 15:58:01.855784+00'),
	('c796e286-a371-4724-b085-3a2e1e19ca38', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_received', 'Feedback Recebido', 'Você recebeu uma avaliação para o chamado ACS-TK-202506-0001. Clique para ver os detalhes.', 'medium', true, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-07-01 15:58:01.855784+00', '2025-07-01 15:58:07.318361+00'),
	('e380b698-4b71-4f1e-b4cd-e61f605ddefc', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Status Alterado: ACS-TK-202507-0001', 'Status do seu ticket "Endpoint Antivirus - Activation Alert" foi alterado de in_progress para resolved', 'high', true, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 15:37:15.148806+00', '2025-07-01 15:58:38.070436+00'),
	('7450e5a2-5482-4ef2-826a-84b5eedf3a7d', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0002', 'Novo ticket criado: "ESET Security not Activated - Joanne Scalzitti" por User Test Account', 'medium', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 14:43:21.59479+00', '2025-07-01 15:58:38.070436+00'),
	('0347d7e4-ffc0-45bf-8c67-dd21e51b58de', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 15:26:06.165064+00', '2025-07-01 15:58:38.070436+00'),
	('c6646839-4d0a-4be6-9c7a-46a9e951cc12', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Status Alterado: ACS-TK-202507-0001', 'Status do seu ticket "Endpoint Antivirus - Activation Alert" foi alterado de in_progress para resolved', 'high', true, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 15:26:06.276572+00', '2025-07-01 15:58:38.070436+00'),
	('1bd6cbf7-662f-48d6-a12f-88a19610e0c6', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'comment_added', '💬 Nova Mensagem Recebida', 'Você recebeu uma nova mensagem no chamado ACS-TK-202507-0002. Clique para ver a mensagem e continuar a conversa.', 'medium', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 14:51:47.9+00', '2025-07-01 16:01:52.173556+00'),
	('14de532c-bcc2-4cad-8b81-692052d76b0e', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 15:22:10.033703+00', '2025-07-01 16:01:52.173556+00'),
	('92f82087-4b30-4459-a5bf-18fe47db2b13', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0002', 'Status do seu ticket "ESET Security not Activated - Joanne Scalzitti" foi alterado de in_progress para resolved', 'high', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 15:22:10.199985+00', '2025-07-01 16:01:52.173556+00'),
	('493a2939-30b5-4798-899a-ed30788c451e', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0002 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 15:22:10.358036+00', '2025-07-01 16:01:52.173556+00'),
	('5ba48153-95ef-49df-b6a1-b59dece8370b', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0002', 'Status do seu ticket "ESET Security not Activated - Joanne Scalzitti" foi alterado de in_progress para resolved', 'high', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 15:22:35.575566+00', '2025-07-01 16:01:52.173556+00'),
	('e1cc0276-25a7-41d0-9107-3553c54d34af', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0002 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 15:22:35.698161+00', '2025-07-01 16:01:52.173556+00'),
	('f73eea8e-d1cd-4cf2-8db7-0dd291a62660', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0002', 'Status do seu ticket "ESET Security not Activated - Joanne Scalzitti" foi alterado de in_progress para resolved', 'high', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 15:25:26.391748+00', '2025-07-01 16:01:52.173556+00'),
	('018ae80d-2b20-47cd-8058-55f18b34796e', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0002 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '2025-07-01 15:25:26.506578+00', '2025-07-01 16:01:52.173556+00'),
	('a71cf481-3c4d-4815-98a6-e4aedaad399a', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0001 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 15:26:06.377851+00', '2025-07-01 15:58:38.070436+00'),
	('672bd7cb-3b00-4bff-9f87-0f8c54fd08ca', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0001 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '2025-07-01 15:37:15.275505+00', '2025-07-01 15:58:38.070436+00'),
	('c5e8f96e-5c01-41fa-8c20-3cc124e835b0', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-07-01 15:57:34.044425+00', '2025-07-01 15:58:38.070436+00'),
	('d862bc38-8173-48be-961a-1c6fd38248c4', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Status Alterado: ACS-TK-202506-0001', 'Status do seu ticket "Test SLA Track Feature" foi alterado de in_progress para resolved', 'high', true, '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '2025-07-01 15:57:34.164262+00', '2025-07-01 15:58:38.070436+00'),
	('0424f5a4-6683-4b7f-879f-e64be60830be', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0003', 'Novo ticket criado: "Test labels issue" por User Test Account', 'medium', false, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:02:48.594311+00', '2025-07-01 16:02:48.594311+00'),
	('572466a7-fd34-4c5a-bc2f-e4e0cb20223d', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0003', 'Novo ticket criado: "Test labels issue" por User Test Account', 'medium', false, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:02:48.594311+00', '2025-07-01 16:02:48.594311+00'),
	('1e9621a7-c6d3-428e-bf28-15a787780356', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'comment_added', '💬 Nova Mensagem Recebida', 'Você recebeu uma nova mensagem no chamado ACS-TK-202507-0003. Clique para ver a mensagem e continuar a conversa.', 'medium', true, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:02:58.271+00', '2025-07-01 16:05:59.141659+00'),
	('f776b72a-1e4d-470e-9872-946fc74e4b75', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:03:52.217332+00', '2025-07-01 16:05:59.141659+00'),
	('18b4f7fb-82b2-418c-b01e-c5b8cddafa11', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0003', 'Status do seu ticket "Test labels issue" foi alterado de in_progress para resolved', 'high', true, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:03:52.332032+00', '2025-07-01 16:05:59.141659+00'),
	('08f23c89-4d0b-4ef5-84f0-9435a7e71147', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0003 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:03:52.453969+00', '2025-07-01 16:05:59.141659+00'),
	('c35d4297-e477-40f5-a604-c0bb010ad6ce', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0003', 'Novo ticket criado: "Test labels issue" por User Test Account', 'medium', true, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-01 16:02:48.594311+00', '2025-07-02 08:42:26.878432+00'),
	('1565cf08-b81b-483a-a81a-9f6394464ae5', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-02 13:05:44.484474+00', '2025-07-02 13:05:44.484474+00'),
	('2e9b79fd-b560-4320-bed3-ab48bcfffdd3', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0003', 'Status do seu ticket "Test labels issue" foi alterado de in_progress para resolved', 'high', false, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-02 13:05:44.651846+00', '2025-07-02 13:05:44.651846+00'),
	('896557c6-99f5-42b4-9000-06be5c63df5a', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0003 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-02 13:05:44.778178+00', '2025-07-02 13:05:44.778178+00'),
	('5b2dad4f-5fd4-4874-8832-db024c468791', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0004', 'Novo ticket criado: "Eset license problem" por Felipe dos Santos Henrique', 'medium', false, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:09:38.735031+00', '2025-07-02 13:09:38.735031+00'),
	('5e599e52-27d0-4c75-b795-e4f0d32e450a', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0004', 'Novo ticket criado: "Eset license problem" por Felipe dos Santos Henrique', 'medium', false, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:09:38.735031+00', '2025-07-02 13:09:38.735031+00'),
	('6d2d6ba1-3040-4928-9364-a30c77676706', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0005', 'Novo ticket criado: "Eset license problem" por User Test Account', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:10:13.532347+00', '2025-07-02 13:10:13.532347+00'),
	('654baa2a-de77-4ba8-bacd-827c8527decb', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0005', 'Novo ticket criado: "Eset license problem" por User Test Account', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:10:13.532347+00', '2025-07-02 13:10:13.532347+00'),
	('d1c30e8b-29db-4007-b624-ff52df446a7e', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'comment_added', '💬 Nova Mensagem Recebida', 'Você recebeu uma nova mensagem no chamado ACS-TK-202507-0005. Clique para ver a mensagem e continuar a conversa.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:10:46.994+00', '2025-07-02 13:10:47.206031+00'),
	('fe7e6426-8455-4355-95d6-c5438cc19fa4', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:11:26.298074+00', '2025-07-02 13:11:26.298074+00'),
	('95fe3e7f-6ae1-4dbe-90aa-16007a1595f3', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0005', 'Status do seu ticket "Eset license problem" foi alterado de in_progress para resolved', 'high', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:11:26.424152+00', '2025-07-02 13:11:26.424152+00'),
	('b9e81e65-2d76-40c1-8e50-3ce3870a0eea', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:11:26.576943+00', '2025-07-02 13:11:26.576943+00'),
	('f57d2e75-b234-427f-8879-81d132dd9ee8', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0005', 'Status do seu ticket "Eset license problem" foi alterado de in_progress para resolved', 'high', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:11:40.698155+00', '2025-07-02 13:11:40.698155+00'),
	('d396e80d-a349-4334-9858-708e02ae081d', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:11:40.793551+00', '2025-07-02 13:11:40.793551+00'),
	('cb83736e-9f54-46be-99f1-d5d5fd694e7b', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0005', 'Status do seu ticket "Eset license problem" foi alterado de in_progress para resolved', 'high', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:13:31.59416+00', '2025-07-02 13:13:31.59416+00'),
	('9fab7869-22a4-4e83-bb2d-88f55c85c368', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:13:31.704176+00', '2025-07-02 13:13:31.704176+00'),
	('2a33a209-5d48-41af-ac0f-af37a2134ffb', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:14:00.402034+00', '2025-07-02 13:14:00.402034+00'),
	('918d6744-bc25-4ffd-a00a-05ce90b46313', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0005', 'Status do seu ticket "Eset license problem" foi alterado de in_progress para resolved', 'high', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:14:00.509396+00', '2025-07-02 13:14:00.509396+00'),
	('4573b2a8-7276-47a9-8454-5d8be830bf7e', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:14:00.601432+00', '2025-07-02 13:14:00.601432+00'),
	('5a010b8b-f93f-49ce-a10c-0e8480926cb1', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status Alterado: ACS-TK-202507-0005', 'Status do seu ticket "Eset license problem" foi alterado de in_progress para resolved', 'high', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:17:32.456605+00', '2025-07-02 13:17:32.456605+00'),
	('382e835e-efc1-4d5f-966e-a1607c9dd886', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:17:32.556036+00', '2025-07-02 13:17:32.556036+00'),
	('ce10277e-18c3-47ec-be82-d7941680665b', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0006', 'Novo ticket criado: "Outlook Data File Crash " por shravan.muchandi@analytichem.com', 'medium', false, '3ffd597b-e568-491f-9dc3-e844d2ad9f50', '2025-07-02 13:44:23.440964+00', '2025-07-02 13:44:23.440964+00'),
	('328d9166-2660-4881-a103-3931dac9f5e4', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0006', 'Novo ticket criado: "Outlook Data File Crash " por shravan.muchandi@analytichem.com', 'medium', false, '3ffd597b-e568-491f-9dc3-e844d2ad9f50', '2025-07-02 13:44:23.440964+00', '2025-07-02 13:44:23.440964+00'),
	('a8cd9f3a-3673-4160-85de-17e16261f598', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 14:01:09.569447+00', '2025-07-02 14:01:09.569447+00'),
	('d021ceb1-9927-4d30-b3ff-58402eff575a', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status do Ticket Atualizado', 'O status do ticket #ACS-TK-202507-0005 foi alterado para resolved.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 14:01:09.628+00', '2025-07-02 14:01:09.754602+00'),
	('748e180a-b752-4d48-8735-de6b96e0f6c5', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 14:01:09.736+00', '2025-07-02 14:01:09.863683+00'),
	('6e2c2ab1-5f96-4294-a4fc-bce5dadea2a6', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 14:03:43.036795+00', '2025-07-02 14:03:43.036795+00'),
	('30e3a218-5e03-462f-87db-09bf766f115a', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 14:03:43.155+00', '2025-07-02 14:03:43.28651+00'),
	('f007bd85-9600-4ee5-9324-981550eebf65', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0004 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:52:39.684+00', '2025-07-02 14:08:29.394816+00'),
	('bf13734a-b3f8-4bf4-a385-569eaf236b36', '07463184-ea33-49fc-ba13-109b9a29eb97', 'feedback_received', 'Feedback Recebido', 'Foi recebida uma avaliação para o chamado ACS-TK-202507-0004. Clique para ver os detalhes.', 'low', false, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 14:08:33.60438+00', '2025-07-02 14:08:33.60438+00'),
	('84abcb3f-bc41-4e46-ab36-9a42de2f65f4', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0004', 'Novo ticket criado: "Eset license problem" por Felipe dos Santos Henrique', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:09:38.735031+00', '2025-07-02 14:08:51.84806+00'),
	('0c8990a2-6ea7-4189-bc78-e4a026d1f349', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0005', 'Novo ticket criado: "Eset license problem" por User Test Account', 'medium', true, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 13:10:13.532347+00', '2025-07-02 14:08:51.84806+00'),
	('4d3f81e4-559b-4cf0-9f42-f34e3b617179', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0006', 'Novo ticket criado: "Outlook Data File Crash " por shravan.muchandi@analytichem.com', 'medium', true, '3ffd597b-e568-491f-9dc3-e844d2ad9f50', '2025-07-02 13:44:23.440964+00', '2025-07-02 14:08:51.84806+00'),
	('7650034c-bc4a-40f6-bd06-4bdc0743f3c6', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_assigned', '', '', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:46:12.176126+00', '2025-07-02 14:08:51.84806+00'),
	('5acc8884-b1e6-410b-a6ce-4a5f0d0d199a', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_assigned', '', '', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:46:39.955813+00', '2025-07-02 14:08:51.84806+00'),
	('18e4c8ac-8bb4-4f1a-8c2d-6c8b72e29dab', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:52:39.551118+00', '2025-07-02 14:08:51.84806+00'),
	('908918e6-2b86-4225-b2a4-6c68c4a9f5c2', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Status do Ticket Atualizado', 'O status do ticket #ACS-TK-202507-0004 foi alterado para resolved.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 13:52:39.557+00', '2025-07-02 14:08:51.84806+00'),
	('deaaf290-33f7-4f79-87f3-33a27c1fb239', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_received', 'Feedback Recebido', 'Você recebeu uma avaliação para o chamado ACS-TK-202507-0004. Clique para ver os detalhes.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 14:08:33.60438+00', '2025-07-02 14:08:51.84806+00'),
	('db08a9a8-e2a3-4299-8214-9ac0ab0e76b5', '07463184-ea33-49fc-ba13-109b9a29eb97', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0007', 'Novo ticket criado: "teste" por Felipe dos Santos Henrique', 'medium', false, 'e4178b50-3617-4a7a-b9ec-ebdf5dfff523', '2025-07-02 14:28:58.140192+00', '2025-07-02 14:28:58.140192+00'),
	('662a32d1-f1c5-4955-b322-73639c7f8b29', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0007', 'Novo ticket criado: "teste" por Felipe dos Santos Henrique', 'medium', false, 'e4178b50-3617-4a7a-b9ec-ebdf5dfff523', '2025-07-02 14:28:58.140192+00', '2025-07-02 14:28:58.140192+00'),
	('34ce9261-2676-48f6-9496-7ff369b49b0f', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'ticket_updated', 'Solicitação de Reabertura Rejeitada', 'Sua solicitação para reabrir o ticket "Test labels issue" foi rejeitada. Motivo: não.', 'medium', false, NULL, '2025-07-02 14:44:38+00', '2025-07-02 14:44:38.111004+00'),
	('591abca2-73f0-4b78-b1da-ae1959f642aa', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'ticket_created', 'Novo Ticket: ACS-TK-202507-0007', 'Novo ticket criado: "teste" por Felipe dos Santos Henrique', 'medium', true, 'e4178b50-3617-4a7a-b9ec-ebdf5dfff523', '2025-07-02 14:28:58.140192+00', '2025-07-02 18:58:54.764269+00'),
	('3b0590b2-3c06-406c-9a92-93ed9337afad', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'ticket_updated', 'Solicitação de Reabertura Aprovada', 'Sua solicitação para reabrir o ticket "Test labels issue" foi aprovada.', 'medium', false, NULL, '2025-07-02 18:59:47.098+00', '2025-07-02 18:59:47.788265+00'),
	('5abdfeea-b873-40e1-bd38-f9300be5f6ea', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 19:00:04.273468+00', '2025-07-02 19:00:04.273468+00'),
	('1b95cd36-1c02-4db4-b20a-bad9e507a3da', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status do Ticket Atualizado', 'O status do ticket #ACS-TK-202507-0005 foi alterado para resolved.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 19:00:04.061+00', '2025-07-02 19:00:04.74198+00'),
	('a512a063-aa8c-4f2a-86f5-352585cbb4d0', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0005 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 19:00:04.205+00', '2025-07-02 19:00:04.864298+00'),
	('9380d0f0-1295-4f55-9467-3a4aedf34d18', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Status do Ticket Atualizado', 'O status do ticket #ACS-TK-202507-0004 foi alterado para resolved.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 19:10:45.523+00', '2025-07-02 19:23:00.142904+00'),
	('39d34236-24db-44b7-8076-81172e6642c0', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0004 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 19:10:45.628+00', '2025-07-02 19:23:00.142904+00'),
	('8993a5d0-8ae7-47a4-b2dc-10b81d72b50a', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status do Ticket Atualizado', 'O status do ticket #ACS-TK-202507-0005 foi alterado para resolved.', 'medium', true, '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '2025-07-02 14:03:43.035+00', '2025-07-03 10:33:46.487932+00'),
	('68e94ae4-9c9c-4c95-9a7d-72a409993a3a', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'ticket_assigned', '', '', 'medium', false, '3ffd597b-e568-491f-9dc3-e844d2ad9f50', '2025-07-03 10:50:48.828895+00', '2025-07-03 10:50:48.828895+00'),
	('f48cf363-7faf-4702-8e61-64f56e9f4e5d', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_request', 'Avalie seu atendimento', 'Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-02 19:10:45.792744+00', '2025-07-04 08:39:56.502619+00'),
	('3633173d-5ff5-4aaf-b673-129387fb1f2d', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'closed', 'Ticket Fechado: ACS-TK-202507-0004', 'Seu ticket "Eset license problem" foi fechado.', 'medium', true, 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '2025-07-03 14:13:48.772778+00', '2025-07-03 15:08:52.256191+00'),
	('b37eea82-f866-406a-9adb-3df9551ebf70', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Status do Ticket Atualizado', 'O status do ticket #ACS-TK-202507-0003 foi alterado para resolved.', 'medium', false, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-04 08:39:41.879+00', '2025-07-04 08:39:42.287802+00'),
	('45b9099a-2d5d-4f2b-8d18-0bd23852aebb', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'status_changed', 'Avalie seu atendimento', 'Seu chamado #ACS-TK-202507-0003 foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.', 'medium', false, '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '2025-07-04 08:39:42.032+00', '2025-07-04 08:39:42.410981+00');


--
-- Data for Name: reopen_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."reopen_requests" ("id", "ticket_id", "user_id", "reason", "status", "reviewed_by", "reviewed_at", "created_at") VALUES
	('224f1336-a78b-4c30-8f02-0552c3f018c4', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'teste', 'approved', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-01 16:22:00.196+00', '2025-07-01 16:20:55.623631+00'),
	('54d11d3a-2be5-4692-80e0-23c5bd9e8757', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'teste', 'rejected', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 14:35:37.703+00', '2025-07-01 16:27:56.956605+00'),
	('5f777846-1634-41df-be48-bb329768725c', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'teste', 'rejected', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 14:44:37.847+00', '2025-07-01 16:26:27.39187+00'),
	('6423e45a-c8be-40e3-bcb9-bb03a4151991', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'teste', 'approved', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-07-02 18:59:46.597+00', '2025-07-01 16:16:55.070732+00');


--
-- Data for Name: sla_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."sla_rules" ("id", "name", "priority", "response_time", "resolution_time", "is_active", "created_at", "updated_at", "escalation_time", "escalation_threshold", "warning_threshold", "business_hours_only") VALUES
	('9d8ece43-bcc2-493a-bc9e-7fdb27fffc40', 'Urgente - 1 hora resposta', 'urgent', 1, 4, true, '2025-06-26 22:45:35.816877+00', '2025-06-26 22:45:35.816877+00', 1, 75, 75, false),
	('9001cca3-1141-4716-96a1-99fab15597d0', 'Alta - 2 horas resposta', 'high', 2, 8, true, '2025-06-26 22:45:35.816877+00', '2025-06-26 22:45:35.816877+00', 1, 75, 75, false),
	('1717e763-8eab-4ae8-a7bd-ae6b1b22bfbd', 'Média - 4 horas resposta', 'medium', 4, 24, true, '2025-06-26 22:45:35.816877+00', '2025-06-26 22:45:35.816877+00', 1, 75, 75, false),
	('c44a6d7d-2352-4f06-a8fa-4592713de9a1', 'Baixa - 8 horas resposta', 'low', 8, 72, true, '2025-06-26 22:45:35.816877+00', '2025-06-26 22:45:35.816877+00', 1, 75, 75, false);


--
-- Data for Name: sla_escalation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sla_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sla_pause_periods; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ticket_activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_activity_logs" ("id", "ticket_id", "user_id", "action_type", "field_name", "old_value", "new_value", "description", "metadata", "created_at") VALUES
	('4c182527-9220-490a-9265-06d5c1ef57c4', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'created', NULL, NULL, NULL, 'Ticket criado por Felipe dos Santos Henrique', '{"title": "Test SLA Track Feature", "status": "open", "priority": "urgent"}', '2025-06-30 08:23:13.088732+00'),
	('67e3aed2-1cf4-4537-b71e-3eca3a50f58a', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'assigned', 'assigned_to', NULL, 'Felipe dos Santos Henrique', 'Ticket atribuído para Felipe dos Santos Henrique por Felipe dos Santos Henrique', NULL, '2025-06-30 09:01:41.407604+00'),
	('46fc84b5-a3ef-441a-9ba5-e9584b47ed8a', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'comment_added', NULL, NULL, NULL, 'Comentário adicionado por Felipe dos Santos Henrique', '{"comment_id": "fdb6f08f-dba2-4f45-8b62-0c3225a26b91", "is_internal": false}', '2025-06-30 14:01:54.18178+00'),
	('11abea4b-859e-4074-ad9d-197f32d0e088', '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'created', NULL, NULL, NULL, 'Ticket criado por Felipe dos Santos Henrique', '{"title": "Endpoint Antivirus - Activation Alert", "status": "open", "priority": "medium"}', '2025-07-01 09:47:22.329085+00'),
	('13aa2af7-1cd9-4548-a225-8ac57e90e121', '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'created', NULL, NULL, NULL, 'Ticket criado por User Test Account', '{"title": "ESET Security not Activated - Joanne Scalzitti", "status": "open", "priority": "high"}', '2025-07-01 14:43:21.296759+00'),
	('102e13b7-feff-4ead-9080-2e4e19df45c3', '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'assigned', 'assigned_to', NULL, 'Felipe dos Santos Henrique', 'Ticket atribuído para Felipe dos Santos Henrique por Felipe dos Santos Henrique', NULL, '2025-07-01 14:49:37.654585+00'),
	('229197b5-4d3f-40e0-a635-1ceeeef26017', '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-01 15:22:10.033703+00'),
	('fc3e4ec7-3fbe-47c4-83ad-95ca7fde5325', '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'Test resolution', '', '{}', '2025-07-01 15:22:10.033703+00'),
	('7aa60228-600c-4161-a267-8e643cb7263c', '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'assigned', 'assigned_to', NULL, 'Felipe dos Santos Henrique', '', '{}', '2025-07-01 15:25:47.254781+00'),
	('bf2e5ba3-6c20-4037-96d7-d8e0604e2891', '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-01 15:26:06.165064+00'),
	('c048c0c7-48fa-4f95-8f47-27461efbca17', '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'Test closure.', '', '{}', '2025-07-01 15:26:06.165064+00'),
	('f188e2ab-96af-42fd-8956-9ae1df0e6d7d', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-01 15:57:34.044425+00'),
	('9348d642-81c5-4b46-8768-4b4aba356bfd', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'teste', '', '{}', '2025-07-01 15:57:34.044425+00'),
	('fda70186-7203-44de-be7b-01713f80a67f', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_received', NULL, NULL, '5 estrelas (unsatisfied)', '', '{"rating": 5, "feedback_id": "344173b2-a3eb-4680-952c-9acb54e398f9", "satisfaction": "unsatisfied"}', '2025-07-01 15:58:01.855784+00'),
	('0427401f-4cca-49b5-8f1a-90e260e18bd8', '341bb53c-bd26-4fe7-a1e3-ecf6a9ba8ab8', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'closed', '', '{}', '2025-07-01 15:58:47.916019+00'),
	('9ce8603e-9a0f-411b-add1-66c1b2695dc5', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'created', NULL, NULL, NULL, '', '{"title": "Test labels issue", "status": "open", "priority": "high"}', '2025-07-01 16:02:47.726759+00'),
	('ad22a22e-df57-4d62-9393-0eb2f6441073', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'assigned', 'assigned_to', NULL, 'Felipe dos Santos Henrique', '', '{}', '2025-07-01 16:03:44.133975+00'),
	('23f4f569-df2a-4394-9d75-a21cbf720cf3', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-01 16:03:52.217332+00'),
	('f9e8abe2-baee-4b2c-aa8c-34227d913820', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'teste', '', '{}', '2025-07-01 16:03:52.217332+00'),
	('dff45223-8ed4-44cd-b68a-d35657a53744', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'open', '', '{}', '2025-07-01 16:21:26.043838+00'),
	('152d23f4-ea1d-4252-b4b1-af52bbb23bb0', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'reopened', NULL, NULL, NULL, '', '{"reason": null}', '2025-07-01 16:21:26.043838+00'),
	('303f137c-fdef-4b37-b542-3612ec91ec64', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'comment_added', NULL, NULL, NULL, '', '{"comment_id": "b3e06370-8624-4f5b-a789-bbeac35a09a0", "is_internal": false}', '2025-07-01 16:21:26.175148+00'),
	('07266f61-40be-4520-bbb0-fb7ab48b1922', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'comment_added', NULL, NULL, NULL, '', '{"comment_id": "3bd7301d-0460-4745-a119-ff7a6b7c9245", "is_internal": false}', '2025-07-01 16:22:00.54942+00'),
	('d6712fc9-f9de-4ae0-aba8-b5f03fae8f60', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 13:05:44.484474+00'),
	('9b2353b5-9c5f-4fc4-acb3-f270b947d766', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'teste', '', '{}', '2025-07-02 13:05:44.484474+00'),
	('165ce004-420c-47e3-8f44-e20d81f1c52b', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'created', NULL, NULL, NULL, '', '{"title": "Eset license problem", "status": "open", "priority": "high"}', '2025-07-02 13:09:38.458647+00'),
	('7d95a835-3c26-4add-8d1e-1f5978122be6', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', 'd897b994-3a4a-46f6-889c-400973aad4b7', 'created', NULL, NULL, NULL, '', '{"title": "Eset license problem", "status": "open", "priority": "high"}', '2025-07-02 13:10:13.204386+00'),
	('634c6019-2647-4044-97e7-098ef7f02226', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'assigned', 'assigned_to', NULL, 'Felipe dos Santos Henrique', '', '{}', '2025-07-02 13:10:32.592159+00'),
	('084b5008-8d02-44d3-9265-c09210a613c0', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 13:11:26.298074+00'),
	('c543b930-c878-4008-a0ee-d38f34075c21', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'teste de resolução', '', '{}', '2025-07-02 13:11:26.298074+00'),
	('ae17581c-3b77-4f13-b291-e7955b40862f', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'open', '', '{}', '2025-07-02 13:13:46.544526+00'),
	('70845bd2-1d64-4533-a7d3-551d67232f6b', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'reopened', NULL, NULL, NULL, '', '{"reason": "abra"}', '2025-07-02 13:13:46.544526+00'),
	('b067d591-82af-4012-99c4-af6f919cb449', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 13:14:00.402034+00'),
	('3d15ba2a-5838-4ba4-9e70-6fe430401db8', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'index-BXb6WhLZ.js:48 ✅ Created ticket status notification
index-BXb6WhLZ.js:100 🔔 Ticket resolved no...', '', '{}', '2025-07-02 13:14:00.402034+00'),
	('3683348c-e68e-4086-8a62-e37da8825e4c', '3ffd597b-e568-491f-9dc3-e844d2ad9f50', '89fb2f47-8781-417a-969c-66f4c2d285ac', 'created', NULL, NULL, NULL, '', '{"title": "Outlook Data File Crash ", "status": "open", "priority": "medium"}', '2025-07-02 13:44:23.045338+00'),
	('5f50035f-dd42-447d-a4ec-06a538283cd2', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'assigned', 'assigned_to', NULL, 'Felipe dos Santos Henrique', '', '{}', '2025-07-02 13:46:11.543441+00'),
	('5a7c33b6-1e32-4d08-8174-7e8839a3e25f', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 13:52:39.551118+00'),
	('83f95134-8ef7-4e22-bd63-08b9c854eb29', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'teste', '', '{}', '2025-07-02 13:52:39.551118+00'),
	('08d379ef-8dff-478b-b45c-df4796844661', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'open', '', '{}', '2025-07-02 14:00:56.586559+00'),
	('13c14059-c91d-4179-b575-3a9f65d39e55', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'reopened', NULL, NULL, NULL, '', '{"reason": "teste"}', '2025-07-02 14:00:56.586559+00'),
	('cff2a3be-e849-44d3-b239-c68fac405245', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 14:01:09.569447+00'),
	('31e40026-0933-4233-9b58-13e4155f0028', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'teste', '', '{}', '2025-07-02 14:01:09.569447+00'),
	('13b9ad09-dae3-43dd-80ca-452d669585cd', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'open', '', '{}', '2025-07-02 14:03:33.300295+00'),
	('32b2794a-a8b5-493e-8e69-ad22122ae2ab', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'reopened', NULL, NULL, NULL, '', '{"reason": "asdasd"}', '2025-07-02 14:03:33.300295+00'),
	('2fec63b3-1781-4853-8d12-ee0d78811bbb', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 14:03:43.036795+00'),
	('b9324a83-1264-4280-b01d-3eea17f7ed29', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'teste', '', '{}', '2025-07-02 14:03:43.036795+00'),
	('d86a5906-7317-464b-b3d6-943be9e83881', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'feedback_received', NULL, NULL, '5 estrelas (unsatisfied)', '', '{"rating": 5, "feedback_id": "b0828236-0eb4-4d85-8a6b-b4b85bf581d7", "satisfaction": "unsatisfied"}', '2025-07-02 14:08:33.60438+00'),
	('e782e8b8-a146-415d-bb96-da22aa655e82', 'e4178b50-3617-4a7a-b9ec-ebdf5dfff523', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'created', NULL, NULL, NULL, '', '{"title": "teste", "status": "open", "priority": "medium"}', '2025-07-02 14:28:57.865796+00'),
	('5e4ee013-5547-4872-b1d7-585671cf83c5', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'open', '', '{}', '2025-07-02 14:29:13.682027+00'),
	('2534d944-6eec-4e9c-844d-4dcf5f7d5535', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'reopened', NULL, NULL, NULL, '', '{"reason": "teste"}', '2025-07-02 14:29:13.682027+00'),
	('f3389ef0-1775-4910-9d4c-5d5c9f0a47ee', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'open', '', '{}', '2025-07-02 14:35:23.770573+00'),
	('24f0ac18-521a-4720-ac1f-25beefa95ba1', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'reopened', NULL, NULL, NULL, '', '{"reason": "teste"}', '2025-07-02 14:35:23.770573+00'),
	('ae3e1932-0a8e-4446-a60f-a67d91ce5af5', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'open', '', '{}', '2025-07-02 18:59:47.446305+00'),
	('b214c5e6-5dde-4568-b5d3-ea030edd460b', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'reopened', NULL, NULL, NULL, '', '{"reason": null}', '2025-07-02 18:59:47.446305+00'),
	('6f260ec9-f2d2-4faa-a998-171ab948fbc2', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'comment_added', NULL, NULL, NULL, '', '{"comment_id": "44602d2d-6b1c-4f39-95c7-7de0c5a8b392", "is_internal": false}', '2025-07-02 18:59:47.626363+00'),
	('ba97f283-8b4b-4a95-a35f-967eaee4c76e', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 19:00:04.273468+00'),
	('c140799c-f00f-4e52-be8f-64c8174ab28f', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'Resolvido', '', '{}', '2025-07-02 19:00:04.273468+00'),
	('518159c7-7851-4199-9ecc-e796248686fd', '21a70b8f-1de5-4cd7-8ccf-cf67e7bb9dcf', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'closed', '', '{}', '2025-07-02 19:00:21.996655+00'),
	('9345a297-a183-400e-8978-d7310957485c', '6b77ffc1-c4c5-4f46-a6fd-8c775d55a893', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'closed', '', '{}', '2025-07-02 19:02:07.371079+00'),
	('8003c20d-c978-4e4d-b15c-8a21ce0b2a6d', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'resolved', 'closed', '', '{}', '2025-07-02 19:09:29.913712+00'),
	('a7fc879e-4363-4a1e-8b01-fa60aa1838f6', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'status_changed', 'status', 'open', 'resolved', '', '{}', '2025-07-02 19:10:45.792744+00'),
	('5ebb5da8-5abf-4121-8111-6c6db1d844d9', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'resolution_added', 'resolution', NULL, 'fechado.', '', '{}', '2025-07-02 19:10:45.792744+00'),
	('c291f3e2-f53d-46e2-8b98-f958b2125b48', '3ffd597b-e568-491f-9dc3-e844d2ad9f50', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'assigned', 'assigned_to', NULL, 'Shravan Muchandi', '', '{}', '2025-07-03 10:50:48.198101+00');


--
-- Data for Name: ticket_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ticket_comments_new; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_comments_new" ("id", "ticket_id", "user_id", "content", "is_internal", "created_at", "updated_at") VALUES
	('fdb6f08f-dba2-4f45-8b62-0c3225a26b91', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', false, '2025-06-30 14:01:54.019+00', '2025-06-30 14:01:54.18178+00'),
	('b3e06370-8624-4f5b-a789-bbeac35a09a0', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Ticket reaberto após aprovação da solicitação. Motivo original: "teste"

Comentário do revisor: Obrigado!', false, '2025-07-01 16:21:26.175148+00', '2025-07-01 16:21:26.175148+00'),
	('3bd7301d-0460-4745-a119-ff7a6b7c9245', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Ticket reaberto após aprovação da solicitação. Motivo original: "teste"

Comentário do revisor: Obrigado!', false, '2025-07-01 16:22:00.54942+00', '2025-07-01 16:22:00.54942+00'),
	('44602d2d-6b1c-4f39-95c7-7de0c5a8b392', '62fc1e1c-1889-405c-bd8e-4de2c2b41916', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'Ticket reaberto após aprovação da solicitação. Motivo original: "teste"

Comentário do revisor: approved', false, '2025-07-02 18:59:47.626363+00', '2025-07-02 18:59:47.626363+00');


--
-- Data for Name: ticket_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_feedback" ("id", "ticket_id", "user_id", "rating", "satisfaction", "comment", "categories", "agent_name", "created_at", "updated_at") VALUES
	('344173b2-a3eb-4680-952c-9acb54e398f9', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 5, 'unsatisfied', NULL, NULL, 'Felipe dos Santos Henrique', '2025-07-01 15:58:01.855784+00', '2025-07-01 15:58:01.855784+00'),
	('b0828236-0eb4-4d85-8a6b-b4b85bf581d7', 'f44c661a-8dae-4ba2-8b3f-87552fae51f9', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 5, 'unsatisfied', NULL, NULL, 'Felipe dos Santos Henrique', '2025-07-02 14:08:33.60438+00', '2025-07-02 14:08:33.60438+00');


--
-- Data for Name: ticket_sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_sequences" ("year_month", "last_sequence", "created_at", "updated_at") VALUES
	('202506', 1, '2025-06-30 08:23:13.088732+00', '2025-06-30 08:23:13.088732+00'),
	('202507', 7, '2025-07-01 09:47:22.329085+00', '2025-07-02 14:28:57.865796+00');


--
-- Data for Name: ticket_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_tasks" ("id", "ticket_id", "title", "description", "assigned_to", "status", "priority", "due_date", "created_by", "created_at", "updated_at", "completed_at") VALUES
	('b6d1b42a-e127-4e9d-84d5-584afa1fdeb0', '9eb13a9a-a451-4611-ac78-bad3a03bfa32', 'teste', 'teste', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'open', 'medium', '2025-07-01 15:30:00+00', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-06-30 14:30:58.827429+00', '2025-06-30 14:30:58.827429+00', NULL);


--
-- Data for Name: ticket_task_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_task_comments" ("id", "task_id", "user_id", "comment", "created_at", "updated_at") VALUES
	('4a3fe260-234e-496b-93ad-e0c6ba8d59f2', 'b6d1b42a-e127-4e9d-84d5-584afa1fdeb0', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', 'teste', '2025-06-30 14:31:10.7575+00', '2025-06-30 14:31:10.7575+00');


--
-- Data for Name: todo_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id") VALUES
	('avatars', 'avatars', NULL, '2025-06-07 00:10:04.50079+00', '2025-06-07 00:10:04.50079+00', true, false, 5242880, '{image/jpeg,image/png,image/webp,image/gif}', NULL),
	('attachments', 'attachments', NULL, '2025-06-07 00:10:04.50079+00', '2025-06-07 00:10:04.50079+00', false, false, 52428800, NULL, NULL),
	('chat-files', 'chat-files', NULL, '2025-06-12 11:00:47.342352+00', '2025-06-12 11:00:47.342352+00', true, false, NULL, NULL, NULL),
	('chat-attachments', 'chat-attachments', NULL, '2025-06-20 16:23:59.997391+00', '2025-06-20 16:23:59.997391+00', false, false, NULL, NULL, NULL);


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") VALUES
	('10acf584-bd33-45eb-8943-efe3bcf59f96', 'avatars', 'cc4ed50d-5ba6-4d98-b58a-ee74e14d89e3/avatar-1750857801940.jpg', 'cc4ed50d-5ba6-4d98-b58a-ee74e14d89e3', '2025-06-25 13:23:23.924538+00', '2025-06-25 13:23:23.924538+00', '2025-06-25 13:23:23.924538+00', '{"eTag": "\"6fbc04c5881fef95823fc353d8ae3895\"", "size": 105879, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-06-25T13:23:24.000Z", "contentLength": 105879, "httpStatusCode": 200}', '18976f75-3dd6-4454-b5ce-2da2ef4b332e', 'cc4ed50d-5ba6-4d98-b58a-ee74e14d89e3', '{}'),
	('a69f616d-9759-40ea-a61e-aed544a0301a', 'avatars', '5ac2883b-68c6-4ebb-b960-9a4171c048fe/avatar-1750979685010.jpg', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '2025-06-26 23:14:46.059231+00', '2025-06-26 23:14:46.059231+00', '2025-06-26 23:14:46.059231+00', '{"eTag": "\"43dfe1ae53705875f87d8d3112a22def\"", "size": 120015, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-06-26T23:14:46.000Z", "contentLength": 120015, "httpStatusCode": 200}', '44747817-58e4-45d1-9ae5-9a4850d87c35', '5ac2883b-68c6-4ebb-b960-9a4171c048fe', '{}');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 2228, true);


--
-- Name: debug_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."debug_logs_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

RESET ALL;
