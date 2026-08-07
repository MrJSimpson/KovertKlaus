--
-- PostgreSQL database dump
--

\restrict BKfb55xgEpEWFuE1vvDnEIEiGO0JkCLIb46Yx816WEiPWdR2bW7bIBGtnmB7RXj

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: kovert
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO kovert;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: kovert
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AccountStatus; Type: TYPE; Schema: public; Owner: kovert
--

CREATE TYPE public."AccountStatus" AS ENUM (
    'ACTIVE',
    'REMOTE_RESTRICTED',
    'DISABLED'
);


ALTER TYPE public."AccountStatus" OWNER TO kovert;

--
-- Name: AgentRole; Type: TYPE; Schema: public; Owner: kovert
--

CREATE TYPE public."AgentRole" AS ENUM (
    'OPS_LEADER',
    'FIELD_AGENT'
);


ALTER TYPE public."AgentRole" OWNER TO kovert;

--
-- Name: GiftingType; Type: TYPE; Schema: public; Owner: kovert
--

CREATE TYPE public."GiftingType" AS ENUM (
    'SINGLE',
    'MULTIPLE'
);


ALTER TYPE public."GiftingType" OWNER TO kovert;

--
-- Name: MissionStatus; Type: TYPE; Schema: public; Owner: kovert
--

CREATE TYPE public."MissionStatus" AS ENUM (
    'SETUP',
    'RECRUITING',
    'ASSIGNED',
    'SHIPPED',
    'EXECUTED',
    'COMPLETED'
);


ALTER TYPE public."MissionStatus" OWNER TO kovert;

--
-- Name: OpKitType; Type: TYPE; Schema: public; Owner: kovert
--

CREATE TYPE public."OpKitType" AS ENUM (
    'WISHLIST',
    'WHITE_ELEPHANT'
);


ALTER TYPE public."OpKitType" OWNER TO kovert;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: kovert
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'FREE_ANNUAL',
    'PAID',
    'EXEMPT_SELF_HOSTED'
);


ALTER TYPE public."PaymentStatus" OWNER TO kovert;

--
-- Name: ShippingStatus; Type: TYPE; Schema: public; Owner: kovert
--

CREATE TYPE public."ShippingStatus" AS ENUM (
    'PENDING',
    'LOCAL_DELIVERY',
    'SHIPPED'
);


ALTER TYPE public."ShippingStatus" OWNER TO kovert;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AfterActionReport; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."AfterActionReport" (
    id text NOT NULL,
    "missionId" text NOT NULL,
    "userId" text NOT NULL,
    "thankYouText" text,
    "photoUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AfterActionReport" OWNER TO kovert;

--
-- Name: ExclusionRule; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."ExclusionRule" (
    id text NOT NULL,
    "missionId" text NOT NULL,
    "agentId" text NOT NULL,
    "restrictedAgentId" text NOT NULL
);


ALTER TABLE public."ExclusionRule" OWNER TO kovert;

--
-- Name: IntelMessage; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."IntelMessage" (
    id text NOT NULL,
    "missionId" text NOT NULL,
    "senderId" text NOT NULL,
    "recipientId" text NOT NULL,
    "messageText" text NOT NULL,
    "isFromSanta" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."IntelMessage" OWNER TO kovert;

--
-- Name: Item; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."Item" (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    price numeric(10,2) NOT NULL,
    description text,
    "thumbnailUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "catalogId" text,
    properties jsonb
);


ALTER TABLE public."Item" OWNER TO kovert;

--
-- Name: Mission; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."Mission" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    code text NOT NULL,
    "opsLeaderId" text NOT NULL,
    "maxParticipants" integer,
    "giftingType" public."GiftingType" DEFAULT 'SINGLE'::public."GiftingType" NOT NULL,
    "isLocalOnly" boolean DEFAULT false NOT NULL,
    "eventLocation" text,
    "isWhiteElephant" boolean DEFAULT false NOT NULL,
    "budgetMin" numeric(10,2),
    "budgetMax" numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "inviteCutoffDate" timestamp(3) without time zone NOT NULL,
    "assignmentDate" timestamp(3) without time zone NOT NULL,
    "shippingDate" timestamp(3) without time zone,
    "executionDate" timestamp(3) without time zone NOT NULL,
    status public."MissionStatus" DEFAULT 'RECRUITING'::public."MissionStatus" NOT NULL,
    "isFreeAnnualOp" boolean DEFAULT false NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'FREE_ANNUAL'::public."PaymentStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "drawVerifiedAt" timestamp(3) without time zone,
    "opsLeaderAssistedDraw" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."Mission" OWNER TO kovert;

--
-- Name: MissionAgent; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."MissionAgent" (
    id text NOT NULL,
    "missionId" text NOT NULL,
    "userId" text NOT NULL,
    "wishlistId" text,
    role public."AgentRole" DEFAULT 'FIELD_AGENT'::public."AgentRole" NOT NULL,
    "targetUserId" text,
    "shippingStatus" public."ShippingStatus" DEFAULT 'PENDING'::public."ShippingStatus" NOT NULL,
    "trackingNumber" text,
    "shippedAt" timestamp(3) without time zone,
    "deliveredConfirmed" boolean DEFAULT false NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MissionAgent" OWNER TO kovert;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    "operationId" text,
    "isAcknowledged" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO kovert;

--
-- Name: OpToolCatalog; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."OpToolCatalog" (
    id text NOT NULL,
    url text NOT NULL,
    title text NOT NULL,
    price numeric(10,2) NOT NULL,
    description text,
    "thumbnailUrl" text,
    domain text,
    properties jsonb,
    "scrapedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."OpToolCatalog" OWNER TO kovert;

--
-- Name: User; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    codename text,
    "passwordHash" text NOT NULL,
    "streetAddress" text,
    city text,
    state text,
    "zipCode" text,
    country text DEFAULT 'US'::text,
    demerits integer DEFAULT 0 NOT NULL,
    "accountStatus" public."AccountStatus" DEFAULT 'ACTIVE'::public."AccountStatus" NOT NULL,
    "emailNotifications" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "addressLine2" text,
    "allergiesDiet" text,
    "deliveryNotes" text,
    dislikes text,
    "favoriteColors" text,
    "favoriteHobbies" text,
    "shirtSize" text,
    "shoeSize" text,
    "allowOperatorViewFavorites" boolean DEFAULT false NOT NULL,
    "bottomHalfSize" text,
    "topHalfSize" text,
    "allowOperatorViewAllergies" boolean DEFAULT true NOT NULL,
    "allowOperatorViewMeasurements" boolean DEFAULT false NOT NULL,
    "allowOperatorViewSizes" boolean DEFAULT true NOT NULL,
    "chestBustMeasurement" text,
    "inseamMeasurement" text,
    "waistMeasurement" text
);


ALTER TABLE public."User" OWNER TO kovert;

--
-- Name: Wishlist; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."Wishlist" (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    type public."OpKitType" DEFAULT 'WISHLIST'::public."OpKitType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Wishlist" OWNER TO kovert;

--
-- Name: WishlistItem; Type: TABLE; Schema: public; Owner: kovert
--

CREATE TABLE public."WishlistItem" (
    id text NOT NULL,
    "wishlistId" text NOT NULL,
    "itemId" text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."WishlistItem" OWNER TO kovert;

--
-- Data for Name: AfterActionReport; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."AfterActionReport" (id, "missionId", "userId", "thankYouText", "photoUrl", "createdAt") FROM stdin;
\.


--
-- Data for Name: ExclusionRule; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."ExclusionRule" (id, "missionId", "agentId", "restrictedAgentId") FROM stdin;
\.


--
-- Data for Name: IntelMessage; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."IntelMessage" (id, "missionId", "senderId", "recipientId", "messageText", "isFromSanta", "createdAt") FROM stdin;
\.


--
-- Data for Name: Item; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."Item" (id, "userId", name, url, price, description, "thumbnailUrl", "createdAt", "updatedAt", "catalogId", properties) FROM stdin;
\.


--
-- Data for Name: Mission; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."Mission" (id, title, description, code, "opsLeaderId", "maxParticipants", "giftingType", "isLocalOnly", "eventLocation", "isWhiteElephant", "budgetMin", "budgetMax", currency, "inviteCutoffDate", "assignmentDate", "shippingDate", "executionDate", status, "isFreeAnnualOp", "paymentStatus", "createdAt", "updatedAt", "drawVerifiedAt", "opsLeaderAssistedDraw") FROM stdin;
5e0c8528-04c6-42fe-b95c-cffcb637a8b4	Simpson Family Secret Santa	\N	SIMPSON-2026	2e65ae12-b926-4489-b220-8e704d983bda	\N	SINGLE	f	\N	f	25.00	50.00	USD	2026-12-01 00:00:00	2026-12-05 00:00:00	2026-12-15 00:00:00	2026-12-25 00:00:00	RECRUITING	f	FREE_ANNUAL	2026-08-04 22:22:16.799	2026-08-04 22:22:16.799	\N	t
120d0188-9510-4132-af05-c3711d12f6ec	Simpson White Elephant 2026	\N	WQRE-JXHG	2e65ae12-b926-4489-b220-8e704d983bda	5	SINGLE	t	6189 Pine Rd NE, Bremerton, WA 98311	t	0.00	50.00	USD	2026-09-10 00:00:00	2026-10-15 00:00:00	2026-11-19 00:00:00	2026-12-25 00:00:00	RECRUITING	f	EXEMPT_SELF_HOSTED	2026-08-06 02:04:18.889	2026-08-06 02:04:18.889	\N	t
\.


--
-- Data for Name: MissionAgent; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."MissionAgent" (id, "missionId", "userId", "wishlistId", role, "targetUserId", "shippingStatus", "trackingNumber", "shippedAt", "deliveredConfirmed", "joinedAt") FROM stdin;
b3a2c441-c2ee-4087-89ab-d4e8dba47b1e	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	2e65ae12-b926-4489-b220-8e704d983bda	\N	OPS_LEADER	\N	PENDING	\N	\N	f	2026-08-04 22:22:16.807
8dd47743-b968-4002-bc3e-7cb8a09a5d23	120d0188-9510-4132-af05-c3711d12f6ec	2e65ae12-b926-4489-b220-8e704d983bda	\N	OPS_LEADER	\N	PENDING	\N	\N	f	2026-08-06 02:04:18.889
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."Notification" (id, "userId", title, message, "operationId", "isAcknowledged", "createdAt") FROM stdin;
8c00fba9-1ddf-4877-86d6-4fb454ea3904	271f7a54-689d-4a3d-9d40-74b5da8a5ac5	???? Invited to Operation: Simpson Family Secret Santa	You have been invited by Joshua Simpson to join "Simpson Family Secret Santa". Use Invite Code: SIMPSON-2026	5e0c8528-04c6-42fe-b95c-cffcb637a8b4	f	2026-08-06 02:27:44.768
\.


--
-- Data for Name: OpToolCatalog; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."OpToolCatalog" (id, url, title, price, description, "thumbnailUrl", domain, properties, "scrapedAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."User" (id, email, name, codename, "passwordHash", "streetAddress", city, state, "zipCode", country, demerits, "accountStatus", "emailNotifications", "createdAt", "updatedAt", "addressLine2", "allergiesDiet", "deliveryNotes", dislikes, "favoriteColors", "favoriteHobbies", "shirtSize", "shoeSize", "allowOperatorViewFavorites", "bottomHalfSize", "topHalfSize", "allowOperatorViewAllergies", "allowOperatorViewMeasurements", "allowOperatorViewSizes", "chestBustMeasurement", "inseamMeasurement", "waistMeasurement") FROM stdin;
2e65ae12-b926-4489-b220-8e704d983bda	joshua@example.com	Joshua Simpson	Chewie	$2b$12$2Ujfumh4K6RHdecmC31do./p7jIrNoVC4mfwNz15e.laZndrbmYmm	6189 Pine Rd NE	Bremerton	WA	98311	US	0	ACTIVE	t	2026-08-04 22:22:16.747	2026-08-05 22:45:57.722	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
2b2852e9-5126-4b57-9158-dbaa1463eaca	zachary@example.com	Zachary Simpson	Zachary	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.493	2026-08-06 02:26:58.493	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
271f7a54-689d-4a3d-9d40-74b5da8a5ac5	shannon@example.com	Shannon Jaelynn Simpson	Shannon	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.505	2026-08-06 02:26:58.505	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
af08be00-376c-4871-bd05-e7bf2ea83841	matthew@example.com	Matthew Simpson	Matthew	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.512	2026-08-06 02:26:58.512	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
d151148c-aef8-434e-a048-43781cdeeddf	leslie@example.com	Leslie Simpson-Crawford	Leslie	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.52	2026-08-06 02:26:58.52	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
8532980e-3e08-4b53-82fd-4bd87284eb4e	charles@example.com	Charles Crawford	Charles	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.529	2026-08-06 02:26:58.529	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
864d4a8e-249a-4aff-a630-a3c1ef5ff65a	david@example.com	David Simpson	David	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.536	2026-08-06 02:26:58.536	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
b9868ab1-79ea-430a-966d-fab5eadfed14	debbie@example.com	Debbie Kraemer	Debbie	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.541	2026-08-06 02:26:58.541	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
7e6f8041-20e4-4f9c-95be-58462622b542	michael@example.com	Michael Kelly	Michael	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.548	2026-08-06 02:26:58.548	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
08d55464-478a-4a36-b13a-2cd720c68587	terry@example.com	Terry Kelly	Terry	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.556	2026-08-06 02:26:58.556	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
c6512237-d6b4-4e01-ba3e-180ab7eff431	sharon@example.com	Sharon Goins	Sharon	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.562	2026-08-06 02:26:58.562	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
30fb6940-c586-4a76-a1ab-b91d276835a1	thomas@example.com	Thomas Goins	Thomas	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.567	2026-08-06 02:26:58.567	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
83ec991a-4379-47be-8c1a-47a95aecc053	leonard@example.com	Leonard Courier	Leonard	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.575	2026-08-06 02:26:58.575	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
af7c7907-22d4-4bb1-81cd-b347b999d75f	cheryl@example.com	Cheryl Courier	Cheryl	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.581	2026-08-06 02:26:58.581	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
7122c6f3-1d14-4dea-9856-7950154aff51	kristy@example.com	Kristy Bonifer	Kristy	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.587	2026-08-06 02:26:58.587	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
30c7b060-1ced-4165-8f18-dc157af689a1	dayton@example.com	Dayton Moses	Dayton	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.593	2026-08-06 02:26:58.593	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
66b86c8b-1743-40d5-a8ad-7cd395350ed6	kathy@example.com	Kathy Moses	Kathy	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.6	2026-08-06 02:26:58.6	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
f9ffcf17-cf57-4951-9fdc-6699a3076abf	john@example.com	John Moses	John	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.606	2026-08-06 02:26:58.606	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
1a909af5-cb98-4f38-a8fb-cfaaffdc8c7d	james@example.com	James Moses	James	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.611	2026-08-06 02:26:58.611	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
66295104-5539-45d3-9cad-60a0c329ffaf	julia@example.com	Julia Kelly	Julia	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.617	2026-08-06 02:26:58.617	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
6a43cd31-048d-44fa-81a9-87365a9b3c1f	kimberly@example.com	Kimberly Piercy	Kimberly	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.625	2026-08-06 02:26:58.625	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
634555c4-12c1-452f-97ef-3301a2f6c49c	rodney@example.com	Rodney Piercy	Rodney	$2b$12$uIIvYKgzThFpIw3dqnCuruKy2dcJ9obwncz8Ohhz0lJBgWTnWTqMi	\N	\N	\N	\N	US	0	ACTIVE	t	2026-08-06 02:26:58.631	2026-08-06 02:26:58.631	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	t	f	t	\N	\N	\N
\.


--
-- Data for Name: Wishlist; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."Wishlist" (id, "userId", name, type, "createdAt", "updatedAt") FROM stdin;
4e0608ec-f991-4d33-ba1b-fd4bfc56ae58	2e65ae12-b926-4489-b220-8e704d983bda	Master OpKit - Secret Santa	WISHLIST	2026-08-04 22:25:02.145	2026-08-04 22:25:02.145
f7251af7-d292-4c35-9d80-ef14ad4ac05e	2e65ae12-b926-4489-b220-8e704d983bda	Tools Kit	WISHLIST	2026-08-04 23:03:24.599	2026-08-04 23:03:24.599
c694268a-620f-4643-a05f-5470f711ba4b	2b2852e9-5126-4b57-9158-dbaa1463eaca	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.5	2026-08-06 02:26:58.5
a85a0e82-0041-4fdb-bd53-d99608c1fbfa	271f7a54-689d-4a3d-9d40-74b5da8a5ac5	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.508	2026-08-06 02:26:58.508
cf896d43-5dec-473f-956e-52707201a3e2	af08be00-376c-4871-bd05-e7bf2ea83841	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.515	2026-08-06 02:26:58.515
f2464339-af78-42e0-8b63-d330fb3d28b4	d151148c-aef8-434e-a048-43781cdeeddf	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.523	2026-08-06 02:26:58.523
54c611f5-81fb-40f8-883f-89f5fa1af9e4	8532980e-3e08-4b53-82fd-4bd87284eb4e	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.532	2026-08-06 02:26:58.532
e87236d3-8813-4609-8126-6841d1eb16af	864d4a8e-249a-4aff-a630-a3c1ef5ff65a	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.538	2026-08-06 02:26:58.538
fd55f42a-00cf-4620-8d31-596149163d26	b9868ab1-79ea-430a-966d-fab5eadfed14	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.544	2026-08-06 02:26:58.544
d9a587a8-4d00-474b-8575-55af12880693	7e6f8041-20e4-4f9c-95be-58462622b542	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.552	2026-08-06 02:26:58.552
f233a592-5761-414d-87bc-d4ca8a959fe4	08d55464-478a-4a36-b13a-2cd720c68587	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.559	2026-08-06 02:26:58.559
4cf840ed-1625-46f5-90f7-b9fe54673939	c6512237-d6b4-4e01-ba3e-180ab7eff431	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.564	2026-08-06 02:26:58.564
ea609193-ffbf-41ac-8ba2-53f6d2176583	30fb6940-c586-4a76-a1ab-b91d276835a1	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.57	2026-08-06 02:26:58.57
cb98f366-ec6f-461b-8e74-47fa9e72fda9	83ec991a-4379-47be-8c1a-47a95aecc053	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.577	2026-08-06 02:26:58.577
3dc3f408-511c-4acc-b3cb-7fdf481fe134	af7c7907-22d4-4bb1-81cd-b347b999d75f	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.583	2026-08-06 02:26:58.583
d780c218-4572-48ce-83be-67f5e7bebc21	7122c6f3-1d14-4dea-9856-7950154aff51	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.589	2026-08-06 02:26:58.589
eb0af5a0-4262-4557-ad11-370ad2c4d9f7	30c7b060-1ced-4165-8f18-dc157af689a1	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.596	2026-08-06 02:26:58.596
f8b4773c-c735-4a19-a5ac-dbde8eea274b	66b86c8b-1743-40d5-a8ad-7cd395350ed6	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.603	2026-08-06 02:26:58.603
f86e6af2-2c76-4b98-a2b2-4e0d39864819	f9ffcf17-cf57-4951-9fdc-6699a3076abf	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.608	2026-08-06 02:26:58.608
40804fad-aa12-4461-adde-41569f6f8666	1a909af5-cb98-4f38-a8fb-cfaaffdc8c7d	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.613	2026-08-06 02:26:58.613
355aed5a-b982-4db8-8920-b436fe046800	66295104-5539-45d3-9cad-60a0c329ffaf	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.62	2026-08-06 02:26:58.62
f91ad48c-19e5-401a-aa7d-ea3f33868071	6a43cd31-048d-44fa-81a9-87365a9b3c1f	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.627	2026-08-06 02:26:58.627
c9c63ec3-2b71-41b2-b259-90c07a8e0532	634555c4-12c1-452f-97ef-3301a2f6c49c	Master OpKit - Secret Santa	WISHLIST	2026-08-06 02:26:58.633	2026-08-06 02:26:58.633
9607a2ab-72b0-4aeb-85f7-dcab467d6413	2e65ae12-b926-4489-b220-8e704d983bda	OC White Elephant	WHITE_ELEPHANT	2026-08-06 16:51:04.456	2026-08-06 16:51:04.456
\.


--
-- Data for Name: WishlistItem; Type: TABLE DATA; Schema: public; Owner: kovert
--

COPY public."WishlistItem" (id, "wishlistId", "itemId", quantity) FROM stdin;
\.


--
-- Name: AfterActionReport AfterActionReport_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."AfterActionReport"
    ADD CONSTRAINT "AfterActionReport_pkey" PRIMARY KEY (id);


--
-- Name: ExclusionRule ExclusionRule_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."ExclusionRule"
    ADD CONSTRAINT "ExclusionRule_pkey" PRIMARY KEY (id);


--
-- Name: IntelMessage IntelMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."IntelMessage"
    ADD CONSTRAINT "IntelMessage_pkey" PRIMARY KEY (id);


--
-- Name: Item Item_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_pkey" PRIMARY KEY (id);


--
-- Name: MissionAgent MissionAgent_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."MissionAgent"
    ADD CONSTRAINT "MissionAgent_pkey" PRIMARY KEY (id);


--
-- Name: Mission Mission_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Mission"
    ADD CONSTRAINT "Mission_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OpToolCatalog OpToolCatalog_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."OpToolCatalog"
    ADD CONSTRAINT "OpToolCatalog_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WishlistItem WishlistItem_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_pkey" PRIMARY KEY (id);


--
-- Name: Wishlist Wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_pkey" PRIMARY KEY (id);


--
-- Name: ExclusionRule_missionId_agentId_restrictedAgentId_key; Type: INDEX; Schema: public; Owner: kovert
--

CREATE UNIQUE INDEX "ExclusionRule_missionId_agentId_restrictedAgentId_key" ON public."ExclusionRule" USING btree ("missionId", "agentId", "restrictedAgentId");


--
-- Name: MissionAgent_missionId_userId_key; Type: INDEX; Schema: public; Owner: kovert
--

CREATE UNIQUE INDEX "MissionAgent_missionId_userId_key" ON public."MissionAgent" USING btree ("missionId", "userId");


--
-- Name: Mission_code_key; Type: INDEX; Schema: public; Owner: kovert
--

CREATE UNIQUE INDEX "Mission_code_key" ON public."Mission" USING btree (code);


--
-- Name: OpToolCatalog_url_key; Type: INDEX; Schema: public; Owner: kovert
--

CREATE UNIQUE INDEX "OpToolCatalog_url_key" ON public."OpToolCatalog" USING btree (url);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: kovert
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: WishlistItem_wishlistId_itemId_key; Type: INDEX; Schema: public; Owner: kovert
--

CREATE UNIQUE INDEX "WishlistItem_wishlistId_itemId_key" ON public."WishlistItem" USING btree ("wishlistId", "itemId");


--
-- Name: AfterActionReport AfterActionReport_missionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."AfterActionReport"
    ADD CONSTRAINT "AfterActionReport_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES public."Mission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AfterActionReport AfterActionReport_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."AfterActionReport"
    ADD CONSTRAINT "AfterActionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExclusionRule ExclusionRule_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."ExclusionRule"
    ADD CONSTRAINT "ExclusionRule_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExclusionRule ExclusionRule_missionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."ExclusionRule"
    ADD CONSTRAINT "ExclusionRule_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES public."Mission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExclusionRule ExclusionRule_restrictedAgentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."ExclusionRule"
    ADD CONSTRAINT "ExclusionRule_restrictedAgentId_fkey" FOREIGN KEY ("restrictedAgentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IntelMessage IntelMessage_missionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."IntelMessage"
    ADD CONSTRAINT "IntelMessage_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES public."Mission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IntelMessage IntelMessage_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."IntelMessage"
    ADD CONSTRAINT "IntelMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IntelMessage IntelMessage_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."IntelMessage"
    ADD CONSTRAINT "IntelMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Item Item_catalogId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES public."OpToolCatalog"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Item Item_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MissionAgent MissionAgent_missionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."MissionAgent"
    ADD CONSTRAINT "MissionAgent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES public."Mission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MissionAgent MissionAgent_targetUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."MissionAgent"
    ADD CONSTRAINT "MissionAgent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: MissionAgent MissionAgent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."MissionAgent"
    ADD CONSTRAINT "MissionAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MissionAgent MissionAgent_wishlistId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."MissionAgent"
    ADD CONSTRAINT "MissionAgent_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES public."Wishlist"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Mission Mission_opsLeaderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Mission"
    ADD CONSTRAINT "Mission_opsLeaderId_fkey" FOREIGN KEY ("opsLeaderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WishlistItem WishlistItem_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WishlistItem WishlistItem_wishlistId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."WishlistItem"
    ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES public."Wishlist"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Wishlist Wishlist_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kovert
--

ALTER TABLE ONLY public."Wishlist"
    ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: kovert
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict BKfb55xgEpEWFuE1vvDnEIEiGO0JkCLIb46Yx816WEiPWdR2bW7bIBGtnmB7RXj

