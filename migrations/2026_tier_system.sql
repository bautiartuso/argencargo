-- ═══════════════════════════════════════════════════════════════════
-- Tier system: Silver / Gold / Diamond
-- Basado en puntos ganados cumulative (nunca se baja de tier)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Enum de tiers
DO $$ BEGIN
  CREATE TYPE client_tier AS ENUM ('standard','silver','gold','diamond');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columnas nuevas en clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tier client_tier NOT NULL DEFAULT 'standard';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lifetime_points_earned INT NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tier_achieved_at TIMESTAMPTZ;

-- 3. Tabla de vouchers por tier (descuentos 1x)
CREATE TABLE IF NOT EXISTS tier_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tier client_tier NOT NULL,
  discount_usd NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | applied
  reached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ,
  applied_op_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  UNIQUE(client_id, tier)  -- un solo voucher por tier por cliente
);
CREATE INDEX IF NOT EXISTS idx_tier_rewards_client ON tier_rewards(client_id, status);
CREATE INDEX IF NOT EXISTS idx_tier_rewards_pending ON tier_rewards(status) WHERE status='pending';

-- 4. Función helper: devuelve el tier según puntos ganados
CREATE OR REPLACE FUNCTION compute_tier(pts INT) RETURNS client_tier AS $$
BEGIN
  IF pts >= 1000 THEN RETURN 'diamond';
  ELSIF pts >= 500 THEN RETURN 'gold';
  ELSIF pts >= 100 THEN RETURN 'silver';
  ELSE RETURN 'standard';
  END IF;
END $$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Función: descuento USD por tier
CREATE OR REPLACE FUNCTION tier_discount_usd(t client_tier) RETURNS NUMERIC AS $$
BEGIN
  RETURN CASE t
    WHEN 'silver' THEN 10
    WHEN 'gold' THEN 25
    WHEN 'diamond' THEN 50
    ELSE 0
  END;
END $$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Función: multiplicador de bonus points por tier
CREATE OR REPLACE FUNCTION tier_bonus_multiplier(t client_tier) RETURNS NUMERIC AS $$
BEGIN
  RETURN CASE t
    WHEN 'silver' THEN 1.02
    WHEN 'gold' THEN 1.10
    WHEN 'diamond' THEN 1.15
    ELSE 1.00
  END;
END $$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Trigger: cuando se inserta un earn en points_transactions,
--    recalcula lifetime_points_earned y actualiza tier.
--    Si sube de tier, crea voucher en tier_rewards.
CREATE OR REPLACE FUNCTION on_points_transaction_earn() RETURNS TRIGGER AS $$
DECLARE
  v_lifetime INT;
  v_old_tier client_tier;
  v_new_tier client_tier;
  v_tier_order INT;
  v_tiers client_tier[];
  v_t client_tier;
BEGIN
  -- Sólo sumamos "earn" al lifetime (redeems/expires no cuentan)
  IF NEW.type <> 'earn' OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Recalcular lifetime_points_earned (suma de todos los earn de este cliente)
  SELECT COALESCE(SUM(amount),0) INTO v_lifetime
  FROM points_transactions
  WHERE client_id = NEW.client_id AND type = 'earn';

  -- Tier anterior y nuevo
  SELECT tier INTO v_old_tier FROM clients WHERE id = NEW.client_id;
  v_new_tier := compute_tier(v_lifetime);

  -- Update clients
  UPDATE clients
  SET lifetime_points_earned = v_lifetime,
      tier = v_new_tier,
      tier_achieved_at = CASE WHEN v_new_tier <> v_old_tier THEN now() ELSE tier_achieved_at END
  WHERE id = NEW.client_id;

  -- Si cambió de tier, crear vouchers para cada nuevo tier alcanzado.
  -- (Podría haber saltado 2 tiers de una si ganó muchos puntos juntos.)
  IF v_new_tier <> v_old_tier THEN
    v_tiers := ARRAY['silver','gold','diamond']::client_tier[];
    FOREACH v_t IN ARRAY v_tiers LOOP
      -- Sólo tiers entre old y new (exclusive old, inclusive new)
      IF (v_old_tier = 'standard' OR
          (v_old_tier = 'silver' AND v_t IN ('gold','diamond')) OR
          (v_old_tier = 'gold' AND v_t = 'diamond'))
         AND v_lifetime >= CASE v_t
              WHEN 'silver' THEN 100
              WHEN 'gold' THEN 500
              WHEN 'diamond' THEN 1000 END
      THEN
        INSERT INTO tier_rewards(client_id, tier, discount_usd)
        VALUES (NEW.client_id, v_t, tier_discount_usd(v_t))
        ON CONFLICT (client_id, tier) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_points_earn_tier ON points_transactions;
CREATE TRIGGER trg_points_earn_tier
AFTER INSERT ON points_transactions
FOR EACH ROW EXECUTE FUNCTION on_points_transaction_earn();

-- 8. Backfill inicial: recalcular para todos los clientes existentes
DO $$
DECLARE
  r RECORD;
  v_lifetime INT;
  v_tier client_tier;
  v_t client_tier;
  v_tiers client_tier[] := ARRAY['silver','gold','diamond']::client_tier[];
BEGIN
  FOR r IN SELECT id FROM clients LOOP
    SELECT COALESCE(SUM(amount),0) INTO v_lifetime
    FROM points_transactions
    WHERE client_id = r.id AND type = 'earn';

    v_tier := compute_tier(v_lifetime);

    UPDATE clients
    SET lifetime_points_earned = v_lifetime,
        tier = v_tier,
        tier_achieved_at = CASE WHEN v_tier <> 'standard' AND tier_achieved_at IS NULL THEN now() ELSE tier_achieved_at END
    WHERE id = r.id;

    -- Crear vouchers faltantes para cada tier alcanzado
    FOREACH v_t IN ARRAY v_tiers LOOP
      IF v_lifetime >= CASE v_t
            WHEN 'silver' THEN 100
            WHEN 'gold' THEN 500
            WHEN 'diamond' THEN 1000 END THEN
        INSERT INTO tier_rewards(client_id, tier, discount_usd)
        VALUES (r.id, v_t, tier_discount_usd(v_t))
        ON CONFLICT (client_id, tier) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 9. Trigger BEFORE INSERT: multiplica el earn por el bonus del tier actual.
--    Ej: Silver gana 100 pts → se guardan 102 pts (1.02×).
--    Se aplica ANTES de insertar, para que el after trigger ya sume el valor final.
--    Description se anota con "(+2% tier Silver)" para transparencia.
CREATE OR REPLACE FUNCTION on_points_transaction_bonus() RETURNS TRIGGER AS $$
DECLARE
  v_tier client_tier;
  v_mult NUMERIC;
  v_base INT;
  v_bonus INT;
BEGIN
  IF NEW.type <> 'earn' OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;
  -- Si ya tiene description con "(+X% tier ...)", skip (evita doble aplicación)
  IF NEW.description ~ '\(\+[0-9]+% tier' THEN
    RETURN NEW;
  END IF;

  SELECT tier INTO v_tier FROM clients WHERE id = NEW.client_id;
  v_mult := tier_bonus_multiplier(v_tier);

  IF v_mult > 1 THEN
    v_base := NEW.amount;
    NEW.amount := FLOOR(v_base * v_mult)::INT;
    v_bonus := NEW.amount - v_base;
    NEW.description := COALESCE(NEW.description,'') ||
      ' (+' || ((v_mult - 1) * 100)::INT || '% tier ' || INITCAP(v_tier::TEXT) ||
      ': +' || v_bonus || ' pts)';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_points_earn_bonus ON points_transactions;
CREATE TRIGGER trg_points_earn_bonus
BEFORE INSERT ON points_transactions
FOR EACH ROW EXECUTE FUNCTION on_points_transaction_bonus();

-- 10. Función para aplicar voucher pending al cerrar una op.
--    El admin la llama al marcar is_collected=true (o en close).
--    Busca el voucher pending más alto (diamond > gold > silver) del cliente
--    y lo aplica como discount a la op.
CREATE OR REPLACE FUNCTION apply_tier_voucher_to_op(p_op_id UUID) RETURNS JSON AS $$
DECLARE
  v_client_id UUID;
  v_voucher RECORD;
  v_budget NUMERIC;
BEGIN
  SELECT client_id, budget_total INTO v_client_id, v_budget FROM operations WHERE id = p_op_id;
  IF v_client_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'op not found');
  END IF;

  -- Buscar voucher pending de mayor valor
  SELECT * INTO v_voucher FROM tier_rewards
  WHERE client_id = v_client_id AND status = 'pending'
  ORDER BY discount_usd DESC
  LIMIT 1;

  IF v_voucher IS NULL THEN
    RETURN json_build_object('ok', true, 'applied', false);
  END IF;

  -- Marcar voucher como applied
  UPDATE tier_rewards
  SET status='applied', applied_at=now(), applied_op_id=p_op_id
  WHERE id = v_voucher.id;

  -- Descontar del budget_total (no puede ir negativo)
  UPDATE operations
  SET budget_total = GREATEST(0, budget_total - v_voucher.discount_usd),
      tier_discount_applied_usd = v_voucher.discount_usd,
      tier_discount_applied = v_voucher.tier
  WHERE id = p_op_id;

  RETURN json_build_object('ok', true, 'applied', true, 'tier', v_voucher.tier, 'discount_usd', v_voucher.discount_usd);
END $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Columnas en operations para tracking del descuento aplicado (así el cliente lo ve)
ALTER TABLE operations ADD COLUMN IF NOT EXISTS tier_discount_applied_usd NUMERIC(10,2);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS tier_discount_applied client_tier;

-- 11. RLS: clientes ven sus propios vouchers, admin todo
ALTER TABLE tier_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_rewards_select_own" ON tier_rewards;
CREATE POLICY "tier_rewards_select_own" ON tier_rewards FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "tier_rewards_admin_all" ON tier_rewards;
CREATE POLICY "tier_rewards_admin_all" ON tier_rewards FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ═══════════════════════════════════════════════════════════════════
-- Done. Verificar con:
--   SELECT client_code, first_name, tier, lifetime_points_earned FROM clients ORDER BY lifetime_points_earned DESC;
--   SELECT * FROM tier_rewards ORDER BY reached_at DESC;
-- ═══════════════════════════════════════════════════════════════════
