
-- Allow anon to update credits_used (for test token debit)
CREATE POLICY "Anyone can update credits_used on test links"
ON public.test_links FOR UPDATE
TO anon
USING (is_active = true)
WITH CHECK (is_active = true);
