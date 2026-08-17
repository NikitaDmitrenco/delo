-- Migration 002: Smart Predictive Reminders
-- Adds buffer settings to profiles and duration/reminder fields to tasks

-- 1. Add reminder_buffer_minutes to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS reminder_buffer_minutes INTEGER NOT NULL DEFAULT 20;

-- 2. Add estimated duration and reminder tracking to tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS remind_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;

-- 3. Create index for high-performance Cron lookup
CREATE INDEX IF NOT EXISTS idx_tasks_reminders 
ON tasks (completed, reminder_sent, remind_at)
WHERE completed = false AND reminder_sent = false;
