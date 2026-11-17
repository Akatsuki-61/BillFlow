ALTER TABLE clients ADD COLUMN archived_at text;
--> statement-breakpoint
ALTER TABLE vendors ADD COLUMN archived_at text;
--> statement-breakpoint
CREATE TABLE workspace_activity (
  id text PRIMARY KEY NOT NULL,
  kind text NOT NULL,
  record_id text NOT NULL,
  label text NOT NULL,
  detail text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX workspace_activity_record_idx ON workspace_activity(record_id, created_at);
CREATE TRIGGER backup_revision_activity_insert AFTER INSERT ON workspace_activity
BEGIN UPDATE workspace_backup_state SET revision=revision+1 WHERE id=1; END;
