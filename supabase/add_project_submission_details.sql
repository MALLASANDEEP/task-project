-- Migration: Add Professional Project Submission Details

-- Add new columns to project_submissions table if they don't exist
ALTER TABLE public.project_submissions
ADD COLUMN IF NOT EXISTS project_link text,
ADD COLUMN IF NOT EXISTS completion_summary text,
ADD COLUMN IF NOT EXISTS completion_checklist text,
ADD COLUMN IF NOT EXISTS deliverables text,
ADD COLUMN IF NOT EXISTS next_steps text,
ADD COLUMN IF NOT EXISTS project_documentation text,
ADD COLUMN IF NOT EXISTS documentation_file_name text;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_submissions_has_documentation ON public.project_submissions (documentation_file_name) WHERE documentation_file_name IS NOT NULL;

-- Migration completed successfully
-- New fields support professional project submission details and PDF documentation
-- project_documentation field stores base64 encoded PDF file data
-- documentation_file_name stores the original PDF file name
