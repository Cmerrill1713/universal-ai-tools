-- Migration: Add missing tables for production system
-- Date: 2025-08-21
-- Purpose: Create user_feedback and ensure all required tables exist

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  category TEXT DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can view all feedback" ON public.user_feedback
  FOR SELECT USING (true);

CREATE POLICY "Users can insert feedback" ON public.user_feedback
  FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON public.user_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON public.user_feedback(category);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_feedback_updated_at 
  BEFORE UPDATE ON public.user_feedback 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.user_feedback TO postgres;
GRANT ALL ON public.user_feedback TO anon;
GRANT ALL ON public.user_feedback TO authenticated;
GRANT ALL ON public.user_feedback TO service_role;

-- Add comment
COMMENT ON TABLE public.user_feedback IS 'Stores user feedback for AI improvements and analytics';