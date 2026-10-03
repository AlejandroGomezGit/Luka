CREATE TABLE `transaction_search` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
