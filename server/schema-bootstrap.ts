import type { Pool } from "mysql2";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id int AUTO_INCREMENT NOT NULL,
    openId varchar(64) NOT NULL,
    name text,
    email varchar(320),
    loginMethod varchar(64),
    role enum('user','admin') NOT NULL DEFAULT 'user',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastSignedIn timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_openId_unique (openId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS saved_locations (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    label varchar(160) NOT NULL,
    address varchar(320) NOT NULL,
    latitude double NOT NULL,
    longitude double NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS user_preferences (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    profileType enum('General','Respiratory Sensitive','Older Adult','Child','Outdoor Activity') NOT NULL DEFAULT 'General',
    notificationPreference boolean NOT NULL DEFAULT false,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY user_preferences_userId_unique (userId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS local_accounts (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    email varchar(320) NOT NULL,
    passwordHash varchar(255) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY local_accounts_userId_unique (userId),
    UNIQUE KEY local_accounts_email_unique (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS feedback_messages (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    message varchar(1000) NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    endpoint varchar(700) NOT NULL,
    p256dh varchar(255) NOT NULL,
    auth varchar(255) NOT NULL,
    lastAlertAqi int,
    lastAlertAt timestamp NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY push_subscriptions_endpoint_unique (endpoint)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function ensureDatabaseSchema(pool: Pool) {
  const promisePool = pool.promise();
  for (const statement of schemaStatements) await promisePool.query(statement);
}
