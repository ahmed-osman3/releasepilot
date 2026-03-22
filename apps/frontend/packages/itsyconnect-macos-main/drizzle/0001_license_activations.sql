CREATE TABLE `license_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`encrypted_license_key` text NOT NULL,
	`iv` text NOT NULL,
	`auth_tag` text NOT NULL,
	`encrypted_dek` text NOT NULL,
	`instance_id` text NOT NULL,
	`email` text NOT NULL,
	`activated_at` text NOT NULL
);
