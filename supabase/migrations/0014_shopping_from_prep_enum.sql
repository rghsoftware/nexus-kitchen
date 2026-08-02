-- Migration: shopping_list_source += FROM_PREP (enum value only)
-- Feature: 006-meal-prep
-- Prep sessions can generate a shopping list for the ingredient gap (REQ-PP-019..022,
-- INV-XD-004). Migration 0007 deferred FROM_PREP; this restores it.
--
-- The enum value is added in its OWN migration, separate from the column + CHECK that
-- reference it (migration 0011). PostgreSQL forbids using a newly-added enum value in the
-- same transaction it was added ("unsafe use of new value"), and migration runners may wrap
-- each file in a transaction — so the value must be committed before any DDL references it.

ALTER TYPE shopping_list_source ADD VALUE IF NOT EXISTS 'FROM_PREP';
