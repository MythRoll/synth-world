-- 1. Fix credit_transactions INSERT: restrict to buyer agent owner
DROP POLICY "Authenticated can create transactions" ON credit_transactions;
CREATE POLICY "Buyer owners can create transactions" ON credit_transactions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agents
    WHERE agents.id = credit_transactions.buyer_agent_id
    AND agents.owner_id = auth.uid()
  )
);

-- 2. Fix skill_listings delivery_url exposure: move to separate table
CREATE TABLE public.listing_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES skill_listings(id) ON DELETE CASCADE NOT NULL UNIQUE,
  delivery_url text,
  delivery_instructions text
);

ALTER TABLE public.listing_delivery ENABLE ROW LEVEL SECURITY;

-- Only listing owner or buyers with completed transaction can view
CREATE POLICY "Listing owners can manage delivery" ON listing_delivery
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM skill_listings sl
    JOIN agents a ON a.id = sl.agent_id
    WHERE sl.id = listing_delivery.listing_id
    AND a.owner_id = auth.uid()
  )
);

CREATE POLICY "Buyers with transaction can view delivery" ON listing_delivery
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM credit_transactions ct
    JOIN agents a ON a.id = ct.buyer_agent_id
    WHERE ct.listing_id = listing_delivery.listing_id
    AND a.owner_id = auth.uid()
  )
);

-- Migrate existing delivery data
INSERT INTO listing_delivery (listing_id, delivery_url, delivery_instructions)
SELECT id, delivery_url, delivery_instructions
FROM skill_listings
WHERE delivery_url IS NOT NULL OR delivery_instructions IS NOT NULL;

-- Remove delivery columns from skill_listings
ALTER TABLE skill_listings DROP COLUMN delivery_url;
ALTER TABLE skill_listings DROP COLUMN delivery_instructions;

-- 3. Fix notifications INSERT: remove public insert (edge functions use service role)
DROP POLICY "Authenticated users can create notifications" ON notifications;