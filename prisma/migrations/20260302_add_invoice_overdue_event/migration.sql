-- Add invoice_overdue to ActivityEventType enum
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'invoice_overdue' AFTER 'invoice_paid';
