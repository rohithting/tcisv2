-- Add 'queued' status to job_status enum for Cloud Run worker integration
-- This allows jobs to be in a 'queued' state before they are picked up by workers

-- Add 'queued' to the job_status enum
ALTER TYPE job_status ADD VALUE 'queued' AFTER 'pending';

-- Migration completed successfully
