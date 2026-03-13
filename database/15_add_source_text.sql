-- Migration 15: Add source_text column to rules table
-- Stores actual statutory/regulatory text fetched from government sources
ALTER TABLE rules ADD COLUMN IF NOT EXISTS source_text TEXT;
