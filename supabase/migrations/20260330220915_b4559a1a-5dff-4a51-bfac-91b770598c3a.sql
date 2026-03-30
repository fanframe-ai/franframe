
-- Update default token to be shorter (8 chars alphanumeric)
ALTER TABLE public.test_links ALTER COLUMN token SET DEFAULT substr(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), 1, 8);
