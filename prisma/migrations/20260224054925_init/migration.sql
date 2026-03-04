-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'expired');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'overdue');

-- CreateEnum
CREATE TYPE "LineItemCategory" AS ENUM ('material', 'labor', 'permit', 'other');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('quote_sent', 'quote_viewed', 'quote_follow_up', 'quote_accepted', 'quote_expired', 'invoice_sent', 'invoice_paid', 'invoice_reminder');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "license_number" TEXT,
    "logo_url" TEXT,
    "default_tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "default_labor_rate" DECIMAL(8,2) NOT NULL DEFAULT 95.00,
    "follow_up_template" TEXT DEFAULT 'Hi {customer_name}, just following up on the quote I sent for {job_type}. Let me know if you have any questions.',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "property_notes" TEXT,
    "panel_size" TEXT,
    "service_amps" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL,
    "labor_hours_min" DECIMAL(4,1),
    "labor_hours_max" DECIMAL(4,1),
    "price_range_min" DECIMAL(10,2),
    "price_range_max" DECIMAL(10,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" "LineItemCategory" NOT NULL DEFAULT 'material',
    "default_qty" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "price_range_low" DECIMAL(10,2),
    "price_range_high" DECIMAL(10,2),
    "is_conditional" BOOLEAN NOT NULL DEFAULT false,
    "condition_note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "quote_number" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "job_type" TEXT NOT NULL,
    "scope_notes" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "auto_follow_up" BOOLEAN NOT NULL DEFAULT true,
    "follow_up_days" INTEGER NOT NULL DEFAULT 3,
    "follow_up_count" INTEGER NOT NULL DEFAULT 0,
    "customer_note" TEXT,
    "public_token" TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ,
    "viewed_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "expired_at" TIMESTAMPTZ,
    "next_follow_up" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" "LineItemCategory" NOT NULL DEFAULT 'material',
    "quantity" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_template_item" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "quote_id" UUID,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "due_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" "LineItemCategory" NOT NULL DEFAULT 'material',
    "quantity" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "quote_id" UUID,
    "invoice_id" UUID,
    "event_type" "ActivityEventType" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_customers_user" ON "customers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_templates_slug_key" ON "job_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_public_token_key" ON "quotes"("public_token");

-- CreateIndex
CREATE INDEX "idx_quotes_user_status" ON "quotes"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_quotes_public_token" ON "quotes"("public_token");

-- CreateIndex
CREATE INDEX "idx_quotes_follow_up" ON "quotes"("status", "sent_at");

-- CreateIndex
CREATE INDEX "idx_quote_line_items_quote" ON "quote_line_items"("quote_id");

-- CreateIndex
CREATE INDEX "idx_invoices_user_status" ON "invoices"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "idx_activity_events_user" ON "activity_events"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_template_items" ADD CONSTRAINT "job_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
