-- Seed payment rate and recharge limit configs into system_configs.
-- Idempotent: existing rows (e.g. set via admin UI) are preserved via ON CONFLICT DO NOTHING.
INSERT INTO "system_configs" (key, value, "group", label, updated_at) VALUES
  ('RATE_VND',                 '3000',     'payment', 'VND per 1 Coffee',    NOW()),
  ('RATE_USDT',                '0.15',     'payment', 'USDT per 1 Coffee',   NOW()),
  ('MIN_RECHARGE_AMOUNT',      '10',       'payment', 'Min Recharge (VND)',  NOW()),
  ('MAX_RECHARGE_AMOUNT',      '10000000', 'payment', 'Max Recharge (VND)',  NOW()),
  ('MIN_RECHARGE_AMOUNT_USDT', '10',       'payment', 'Min Recharge (USDT)', NOW()),
  ('MAX_RECHARGE_AMOUNT_USDT', '10000000', 'payment', 'Max Recharge (USDT)', NOW())
ON CONFLICT (key) DO NOTHING;
