-- Aviso por WhatsApp del reempaque que ahorró plata (20/11/2026).
-- wa_notified_at: el cron del bot ya resolvió ese reempaque (avisó o decidió que no corresponde).
-- wa_saving_usd: el ahorro que se le informó al cliente (null = no se le escribió).
alter table public.repack_requests
  add column if not exists wa_notified_at timestamptz,
  add column if not exists wa_saving_usd numeric;

-- budget_synced_at: cuándo se recalculó el presupuesto guardado por este reempaque (regla del
-- 20/11/2026: con un reempaque el presupuesto se actualiza siempre, suba o baje).
alter table public.repack_requests add column if not exists budget_synced_at timestamptz;
