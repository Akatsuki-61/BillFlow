CREATE TABLE `app_setup` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `permissions_pending` integer NOT NULL DEFAULT 1,
  `notifications_enabled` integer NOT NULL DEFAULT 0,
  `calendar_connected` integer NOT NULL DEFAULT 0
);
