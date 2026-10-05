CREATE TABLE `invoice_pdf_exports` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`file_path` text NOT NULL,
	`exported_at` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
