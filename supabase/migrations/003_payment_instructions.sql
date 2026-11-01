-- Free-text instructions shown to clients on unpaid invoices when online payments (Stripe) aren't set up. Idempotent.
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS payment_instructions text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agencies_payment_instructions_len') THEN
    ALTER TABLE public.agencies ADD CONSTRAINT agencies_payment_instructions_len CHECK (payment_instructions IS NULL OR char_length(payment_instructions) <= 2000);
  END IF;
END $$;
