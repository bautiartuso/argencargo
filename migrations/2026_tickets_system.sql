-- Sistema de Tickets / Incidentes (#19 + #20)
-- Permite que clientes abran tickets de soporte y admin los gestione con comentarios.

CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  operation_id    UUID REFERENCES operations(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT DEFAULT 'general' CHECK (category IN ('general','operacion','pago','tracking','reclamo','sugerencia','tecnico')),
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status          TEXT DEFAULT 'open'   CHECK (status IN ('open','in_progress','waiting_client','resolved','closed')),
  assigned_to     UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_by_type TEXT DEFAULT 'client' CHECK (created_by_type IN ('client','admin','agent'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_client     ON support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_op         ON support_tickets(operation_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created    ON support_tickets(created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type   TEXT NOT NULL CHECK (author_type IN ('client','admin','agent','system')),
  author_id     UUID,
  body          TEXT NOT NULL,
  is_internal   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON support_ticket_comments(ticket_id, created_at);

-- Trigger: actualizar updated_at en cada UPDATE del ticket
CREATE OR REPLACE FUNCTION fn_touch_ticket() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN NEW.resolved_at = NOW(); END IF;
  IF NEW.status = 'closed'   AND OLD.status <> 'closed'   THEN NEW.closed_at   = NOW(); END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_touch_ticket ON support_tickets;
CREATE TRIGGER trg_touch_ticket BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION fn_touch_ticket();

-- Trigger: cuando llega un comentario nuevo, marcar ticket como updated
CREATE OR REPLACE FUNCTION fn_bump_ticket_on_comment() RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets SET updated_at = NOW() WHERE id = NEW.ticket_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_bump_ticket_on_comment ON support_ticket_comments;
CREATE TRIGGER trg_bump_ticket_on_comment AFTER INSERT ON support_ticket_comments
  FOR EACH ROW EXECUTE FUNCTION fn_bump_ticket_on_comment();

-- RLS: cliente ve sólo sus tickets, admin ve todo
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_tickets_client_select ON support_tickets;
CREATE POLICY pol_tickets_client_select ON support_tickets FOR SELECT
  USING (client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS pol_tickets_client_insert ON support_tickets;
CREATE POLICY pol_tickets_client_insert ON support_tickets FOR INSERT
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS pol_ticket_comments_select ON support_ticket_comments;
CREATE POLICY pol_ticket_comments_select ON support_ticket_comments FOR SELECT
  USING (
    is_internal = FALSE AND
    ticket_id IN (
      SELECT id FROM support_tickets WHERE client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS pol_ticket_comments_insert ON support_ticket_comments;
CREATE POLICY pol_ticket_comments_insert ON support_ticket_comments FOR INSERT
  WITH CHECK (
    author_type = 'client' AND is_internal = FALSE AND
    ticket_id IN (
      SELECT id FROM support_tickets WHERE client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
    )
  );
