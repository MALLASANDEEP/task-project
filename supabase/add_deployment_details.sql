-- Migration: Add Professional Deployment Details and Project Documentation to Deployments Table

-- Add new columns to deployments table if they don't exist
ALTER TABLE public.deployments
ADD COLUMN IF NOT EXISTS deployment_link text,
ADD COLUMN IF NOT EXISTS change_notes text,
ADD COLUMN IF NOT EXISTS pre_deployment_checklist text,
ADD COLUMN IF NOT EXISTS post_deployment_instructions text,
ADD COLUMN IF NOT EXISTS expected_downtime text,
ADD COLUMN IF NOT EXISTS project_documentation text,
ADD COLUMN IF NOT EXISTS documentation_file_name text;

-- Create indexes for common queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_deployments_deployment_link ON public.deployments (deployment_link) WHERE deployment_link IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deployments_has_documentation ON public.deployments (documentation_file_name) WHERE documentation_file_name IS NOT NULL;

-- Migration completed successfully
-- New fields support professional deployment details and PDF project documentation
-- project_documentation field stores base64 encoded PDF file data
-- documentation_file_name stores the original PDF file name
