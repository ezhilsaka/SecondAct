-- Second Act keeps application data access behind the Next.js API/service layer.
-- Direct Supabase Data API access for app-owned tables is intentionally denied
-- because several tables contain raw report JSON that the API deliberately redacts.

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.user_profiles,
  public.portfolios,
  public.portfolio_holdings,
  public.report_runs,
  public.report_artifacts,
  public.user_usage,
  public._prisma_migrations
FROM anon, authenticated;

ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON public.user_profiles;
CREATE POLICY "secondact_no_direct_client_access"
  ON public.user_profiles
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON public.portfolios;
CREATE POLICY "secondact_no_direct_client_access"
  ON public.portfolios
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON public.portfolio_holdings;
CREATE POLICY "secondact_no_direct_client_access"
  ON public.portfolio_holdings
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON public.report_runs;
CREATE POLICY "secondact_no_direct_client_access"
  ON public.report_runs
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON public.report_artifacts;
CREATE POLICY "secondact_no_direct_client_access"
  ON public.report_artifacts
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON public.user_usage;
CREATE POLICY "secondact_no_direct_client_access"
  ON public.user_usage
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON public._prisma_migrations;
CREATE POLICY "secondact_no_direct_client_access"
  ON public._prisma_migrations
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DO $$
DECLARE
  target_table regclass;
BEGIN
  -- The Graphile Worker schema is internal queue infrastructure, not a client API.
  -- Keep anonymous/client roles away from it and add explicit deny policies only
  -- when the tables exist in the target database.
  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'graphile_worker'
  ) THEN
    EXECUTE 'REVOKE USAGE ON SCHEMA graphile_worker FROM anon, authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA graphile_worker FROM anon, authenticated';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA graphile_worker FROM anon, authenticated';
  END IF;

  FOR target_table IN
    SELECT table_name::regclass
    FROM (
      VALUES
        ('graphile_worker._private_job_queues'),
        ('graphile_worker._private_jobs'),
        ('graphile_worker._private_known_crontabs'),
        ('graphile_worker._private_tasks')
    ) AS targets(table_name)
    WHERE to_regclass(table_name) IS NOT NULL
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %s',
      'secondact_no_direct_client_access',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON %s AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'secondact_no_direct_client_access',
      target_table
    );
  END LOOP;
END $$;

DO $$
BEGIN
  -- The reports bucket is accessed by the server using the service role. The
  -- browser receives short-lived signed URLs from the API instead of using
  -- direct Storage table permissions.
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "secondact_no_direct_client_access" ON storage.objects';
    EXECUTE 'CREATE POLICY "secondact_no_direct_client_access" ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
  END IF;
END $$;

DO $$
BEGIN
  -- The RLS auto-enable helper, if present, is an event-trigger helper only.
  -- It should not be directly callable through PostgREST/RPC by client roles.
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
