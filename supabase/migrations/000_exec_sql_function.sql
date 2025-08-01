-- Create exec_sql function for dynamic SQL execution
-- This is needed for running migrations programmatically

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void AS $$
BEGIN
    EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.exec_sql(text) IS 'Execute dynamic SQL statements - use with caution';