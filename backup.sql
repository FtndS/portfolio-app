--
-- PostgreSQL database dump
--

\restrict MZiltZ8acuj5heqHZgqD1h1mRuy9nalIImoxuyzMD9ppnfgSqouLFl4QcNkn1Hx

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: holdings; Type: TABLE; Schema: public; Owner: ftnds
--

CREATE TABLE public.holdings (
    id integer NOT NULL,
    user_id integer,
    ticker character varying(20) NOT NULL,
    name character varying(255),
    shares numeric(15,6) DEFAULT 0 NOT NULL,
    avg_cost numeric(15,2) DEFAULT 0 NOT NULL,
    sector character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    currency character varying(3) DEFAULT 'USD'::character varying,
    portfolio_id integer,
    market character varying(20) DEFAULT 'US'::character varying
);


ALTER TABLE public.holdings OWNER TO ftnds;

--
-- Name: holdings_id_seq; Type: SEQUENCE; Schema: public; Owner: ftnds
--

CREATE SEQUENCE public.holdings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.holdings_id_seq OWNER TO ftnds;

--
-- Name: holdings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ftnds
--

ALTER SEQUENCE public.holdings_id_seq OWNED BY public.holdings.id;


--
-- Name: journal; Type: TABLE; Schema: public; Owner: ftnds
--

CREATE TABLE public.journal (
    id integer NOT NULL,
    user_id integer,
    title character varying(255),
    content text NOT NULL,
    tickers character varying(255),
    tag character varying(50),
    date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    portfolio_id integer
);


ALTER TABLE public.journal OWNER TO ftnds;

--
-- Name: journal_id_seq; Type: SEQUENCE; Schema: public; Owner: ftnds
--

CREATE SEQUENCE public.journal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.journal_id_seq OWNER TO ftnds;

--
-- Name: journal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ftnds
--

ALTER SEQUENCE public.journal_id_seq OWNED BY public.journal.id;


--
-- Name: portfolio_snapshots; Type: TABLE; Schema: public; Owner: ftnds
--

CREATE TABLE public.portfolio_snapshots (
    id integer NOT NULL,
    portfolio_id integer NOT NULL,
    snapshot_date date NOT NULL,
    total_value numeric(18,2) DEFAULT 0 NOT NULL,
    total_cost numeric(18,2) DEFAULT 0 NOT NULL,
    sector_data jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.portfolio_snapshots OWNER TO ftnds;

--
-- Name: portfolio_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: ftnds
--

CREATE SEQUENCE public.portfolio_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.portfolio_snapshots_id_seq OWNER TO ftnds;

--
-- Name: portfolio_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ftnds
--

ALTER SEQUENCE public.portfolio_snapshots_id_seq OWNED BY public.portfolio_snapshots.id;


--
-- Name: portfolios; Type: TABLE; Schema: public; Owner: ftnds
--

CREATE TABLE public.portfolios (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    currency character varying(3) DEFAULT 'USD'::character varying,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.portfolios OWNER TO ftnds;

--
-- Name: portfolios_id_seq; Type: SEQUENCE; Schema: public; Owner: ftnds
--

CREATE SEQUENCE public.portfolios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.portfolios_id_seq OWNER TO ftnds;

--
-- Name: portfolios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ftnds
--

ALTER SEQUENCE public.portfolios_id_seq OWNED BY public.portfolios.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: ftnds
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.schema_migrations OWNER TO ftnds;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: ftnds
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schema_migrations_id_seq OWNER TO ftnds;

--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ftnds
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: ftnds
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer,
    holding_id integer,
    ticker character varying(20) NOT NULL,
    type character varying(10) NOT NULL,
    shares numeric(15,6) NOT NULL,
    price numeric(15,2) NOT NULL,
    total numeric(15,2) NOT NULL,
    note text,
    date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    portfolio_id integer,
    CONSTRAINT transactions_type_check CHECK (((type)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[])))
);


ALTER TABLE public.transactions OWNER TO ftnds;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: ftnds
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO ftnds;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ftnds
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: ftnds
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO ftnds;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ftnds
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO ftnds;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ftnds
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: holdings id; Type: DEFAULT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.holdings ALTER COLUMN id SET DEFAULT nextval('public.holdings_id_seq'::regclass);


--
-- Name: journal id; Type: DEFAULT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.journal ALTER COLUMN id SET DEFAULT nextval('public.journal_id_seq'::regclass);


--
-- Name: portfolio_snapshots id; Type: DEFAULT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.portfolio_snapshots ALTER COLUMN id SET DEFAULT nextval('public.portfolio_snapshots_id_seq'::regclass);


--
-- Name: portfolios id; Type: DEFAULT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.portfolios ALTER COLUMN id SET DEFAULT nextval('public.portfolios_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: holdings; Type: TABLE DATA; Schema: public; Owner: ftnds
--

COPY public.holdings (id, user_id, ticker, name, shares, avg_cost, sector, created_at, updated_at, currency, portfolio_id, market) FROM stdin;
16	4	CPALL	CPALL	1000.000000	50.00	\N	2026-06-25 07:40:51.943501	2026-06-25 07:40:51.943501	USD	4	US
18	4	SPCX	SPCX	1000.000000	100.00	\N	2026-06-25 07:43:13.22569	2026-06-25 07:43:13.22569	USD	4	US
30	2	NASA	NASA	1.000000	41.71	\N	2026-06-25 16:04:07.52295	2026-06-25 16:04:07.52295	USD	3	US
31	2	NVDA	NVIDIA Corporation	10.970477	130.81	Technology	2026-06-25 16:04:36.679439	2026-06-25 16:04:36.679439	USD	3	US
29	2	BRK-B	Berkshire Hathaway Inc.	4.042411	504.66	Financial Services	2026-06-25 16:03:39.401725	2026-06-25 16:03:39.401725	USD	3	US
17	4	VOO	Vanguard S&P 500 ETF	100.000000	300.00	ETF — US Large Cap	2026-06-25 07:42:02.154121	2026-06-25 07:42:02.154121	USD	4	US
32	2	VOO	Vanguard S&P 500 ETF	9.774683	558.20	ETF — US Large Cap	2026-06-25 16:05:26.925106	2026-06-25 16:05:26.925106	USD	3	US
33	2	QQQM	Invesco NASDAQ 100 ETF	19.479406	213.64	ETF — US Growth	2026-06-25 16:06:07.278643	2026-06-25 16:06:07.278643	USD	3	US
34	2	SMH	VanEck Semiconductor ETF	13.054217	258.87	ETF — Semiconductors	2026-06-25 16:06:42.196858	2026-06-25 16:06:42.196858	USD	3	US
\.


--
-- Data for Name: journal; Type: TABLE DATA; Schema: public; Owner: ftnds
--

COPY public.journal (id, user_id, title, content, tickers, tag, date, created_at, portfolio_id) FROM stdin;
\.


--
-- Data for Name: portfolio_snapshots; Type: TABLE DATA; Schema: public; Owner: ftnds
--

COPY public.portfolio_snapshots (id, portfolio_id, snapshot_date, total_value, total_cost, sector_data) FROM stdin;
1	3	2026-06-25	24987.29	16513.95	[{"pct": 8.164321750553666, "sector": "Financial Services"}, {"pct": 0.1057537453642541, "sector": "Other"}, {"pct": 8.643423923136435, "sector": "Technology"}, {"pct": 23.073005162502717, "sector": "ETF — US Growth"}, {"pct": 33.47601543435234, "sector": "ETF — Semiconductors"}, {"pct": 26.537479984090595, "sector": "ETF — US Large Cap"}]
\.


--
-- Data for Name: portfolios; Type: TABLE DATA; Schema: public; Owner: ftnds
--

COPY public.portfolios (id, user_id, name, description, currency, is_default, created_at) FROM stdin;
3	2	Main Portfolio	\N	USD	t	2026-06-25 15:32:27.478586+00
4	4	Main Portfolio	\N	USD	t	2026-06-25 15:32:27.478586+00
5	1	Main Portfolio	\N	USD	t	2026-06-25 15:32:27.478586+00
6	3	Main Portfolio	\N	USD	t	2026-06-25 15:32:27.478586+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: ftnds
--

COPY public.schema_migrations (id, name, applied_at) FROM stdin;
1	001_phase3_portfolios	2026-06-25 15:12:56.630619+00
2	002_phase3_backfill_portfolios	2026-06-25 15:32:27.478586+00
3	003_repair_null_portfolio_ids	2026-06-25 16:11:52.131319+00
4	004_seed_known_sectors	2026-06-25 16:11:52.140278+00
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: ftnds
--

COPY public.transactions (id, user_id, holding_id, ticker, type, shares, price, total, note, date, created_at, portfolio_id) FROM stdin;
13	4	\N	CPALL	BUY	1000.000000	50.00	50000.00	\N	2026-06-25	2026-06-25 07:40:51.943501	4
14	4	\N	VOO	BUY	100.000000	300.00	30000.00	\N	2026-06-25	2026-06-25 07:42:02.154121	4
15	4	\N	SPCX	BUY	1000.000000	100.00	100000.00	\N	2026-06-25	2026-06-25 07:43:13.22569	4
20	2	\N	BRK-B	BUY	4.042411	504.66	2040.04	\N	2026-06-25	2026-06-25 16:03:39.401725	3
21	2	\N	NASA	BUY	1.000000	41.71	41.71	\N	2026-06-25	2026-06-25 16:04:07.52295	3
22	2	\N	NVDA	BUY	10.970477	130.81	1435.02	\N	2026-06-25	2026-06-25 16:04:36.679439	3
23	2	\N	VOO	BUY	9.774683	558.20	5456.19	\N	2026-06-25	2026-06-25 16:05:26.925106	3
24	2	\N	QQQM	BUY	19.479406	213.64	4161.67	\N	2026-06-25	2026-06-25 16:06:07.278643	3
25	2	\N	SMH	BUY	13.054217	258.87	3379.41	\N	2026-06-25	2026-06-25 16:06:42.196858	3
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ftnds
--

COPY public.users (id, email, password, name, created_at) FROM stdin;
1	film@example.com	$2b$10$1Sj7qwz.4fzNRtCFL9m6E.K/OZpuaNnp60xgbPolihuuLdPZjYOUm	Film	2026-06-24 08:42:51.361845
2	tanadon.sangkhatorn@gmail.com	$2b$10$Qrttm/rpZU7rk1AE1eem/eAs.1ED4kfKTYHTKv2VTzMf///s1HPp6	FtndS	2026-06-24 08:59:51.408129
3	oatgzs@gmail.com	$2b$10$/jvzrxZSD7y81V6T1VCRd.brqNyX3obOaGyK9peQTU1UrhNpxGR8a	โอตะ	2026-06-25 07:23:18.483245
4	boyz@boyz.com	$2b$10$ni1qhsi4PnWxDhB45i/DNOQkYoFZvZOJ83INKtz1IOTUzSAPqcPXW	BOYZ	2026-06-25 07:33:05.592274
\.


--
-- Name: holdings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ftnds
--

SELECT pg_catalog.setval('public.holdings_id_seq', 34, true);


--
-- Name: journal_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ftnds
--

SELECT pg_catalog.setval('public.journal_id_seq', 1, true);


--
-- Name: portfolio_snapshots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ftnds
--

SELECT pg_catalog.setval('public.portfolio_snapshots_id_seq', 18, true);


--
-- Name: portfolios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ftnds
--

SELECT pg_catalog.setval('public.portfolios_id_seq', 6, true);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ftnds
--

SELECT pg_catalog.setval('public.schema_migrations_id_seq', 4, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ftnds
--

SELECT pg_catalog.setval('public.transactions_id_seq', 25, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ftnds
--

SELECT pg_catalog.setval('public.users_id_seq', 4, true);


--
-- Name: holdings holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);


--
-- Name: journal journal_pkey; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_pkey PRIMARY KEY (id);


--
-- Name: portfolio_snapshots portfolio_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_pkey PRIMARY KEY (id);


--
-- Name: portfolio_snapshots portfolio_snapshots_portfolio_id_snapshot_date_key; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_portfolio_id_snapshot_date_key UNIQUE (portfolio_id, snapshot_date);


--
-- Name: portfolios portfolios_pkey; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.portfolios
    ADD CONSTRAINT portfolios_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_name_key UNIQUE (name);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_portfolio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;


--
-- Name: holdings holdings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: journal journal_portfolio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;


--
-- Name: journal journal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.journal
    ADD CONSTRAINT journal_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: portfolio_snapshots portfolio_snapshots_portfolio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.portfolio_snapshots
    ADD CONSTRAINT portfolio_snapshots_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;


--
-- Name: portfolios portfolios_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.portfolios
    ADD CONSTRAINT portfolios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_holding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_holding_id_fkey FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_portfolio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ftnds
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict MZiltZ8acuj5heqHZgqD1h1mRuy9nalIImoxuyzMD9ppnfgSqouLFl4QcNkn1Hx

