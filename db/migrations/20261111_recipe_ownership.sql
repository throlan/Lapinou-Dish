ALTER TABLE recipes ADD COLUMN created_by_account_id uuid REFERENCES app_accounts(id) ON DELETE SET NULL
 DEFAULT NULLIF(current_setting('app.account_id',true),'')::uuid;
-- Do not invent an author for legacy recipes. Managers/admins retain access.
