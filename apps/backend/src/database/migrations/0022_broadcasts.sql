-- GAP-01: Lost Children Broadcasting Portal
-- Migration 0022: broadcast columns on reports + consent audit log

ALTER TABLE reports
  ADD COLUMN is_public_broadcast boolean NOT NULL DEFAULT false,
  ADD COLUMN broadcast_approved_at timestamptz,
  ADD COLUMN broadcast_expires_at timestamptz,
  ADD COLUMN broadcast_extend_count smallint NOT NULL DEFAULT 0;

CREATE INDEX idx_reports_broadcast_active
  ON reports(is_public_broadcast, broadcast_expires_at)
  WHERE is_public_broadcast = true;

CREATE TABLE broadcast_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  guardian_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN (
    'enable',
    'disable',
    'extend',
    'auto_retract_found',
    'auto_retract_user_delete',
    'auto_expire',
    'admin_takedown'
  )),
  ip_address inet,
  user_agent text,
  tos_version text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcast_consent_log_report ON broadcast_consent_log(report_id);
CREATE INDEX idx_broadcast_consent_log_guardian ON broadcast_consent_log(guardian_user_id);
