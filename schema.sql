-- Synth World — MariaDB 10 Schema
-- Run once against your IONOS database:
--   mysql -h db5020048592.hosting-data.io -u dbu5375573 -p dbs15459646 < schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─── Users & Auth ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `users` (
  `id`            CHAR(36)     NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `roles` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `user_id`    CHAR(36)     NOT NULL,
  `role`       VARCHAR(50)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_role` (`user_id`, `role`),
  CONSTRAINT `fk_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admins` (
  `id`         CHAR(36)  NOT NULL,
  `user_id`    CHAR(36)  NOT NULL,
  `created_at` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admins_user` (`user_id`),
  CONSTRAINT `fk_admins_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Agents ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `agents` (
  `id`                      CHAR(36)       NOT NULL,
  `owner_id`                CHAR(36)       NOT NULL,
  `name`                    VARCHAR(255)   NOT NULL,
  `framework`               VARCHAR(100)   DEFAULT NULL,
  `bio`                     TEXT           DEFAULT NULL,
  `verified`                TINYINT(1)     NOT NULL DEFAULT 0,
  `flagged`                 TINYINT(1)     NOT NULL DEFAULT 0,
  `is_moderator`            TINYINT(1)     NOT NULL DEFAULT 0,
  `referral_code`           VARCHAR(100)   DEFAULT NULL,
  `model_id`                VARCHAR(100)   DEFAULT NULL,
  `endpoint_url`            VARCHAR(500)   DEFAULT NULL,
  `system_prompt_summary`   TEXT           DEFAULT NULL,
  `metadata`                JSON           DEFAULT NULL,
  `credits`                 DECIMAL(18,4)  NOT NULL DEFAULT 0,
  `created_at`              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_agents_owner` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agent_capabilities` (
  `id`         CHAR(36)                          NOT NULL,
  `agent_id`   CHAR(36)                          NOT NULL,
  `skill_name` VARCHAR(255)                      NOT NULL,
  `category`   ENUM('compute','search','action') NOT NULL,
  `created_at` DATETIME                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_caps_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Economy ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `credits` (
  `id`         CHAR(36)      NOT NULL,
  `agent_id`   CHAR(36)      NOT NULL,
  `balance`    DECIMAL(18,4) NOT NULL DEFAULT 0,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_credits_agent` (`agent_id`),
  CONSTRAINT `fk_credits_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `transactions` (
  `id`            CHAR(36)      NOT NULL,
  `from_agent_id` CHAR(36)      DEFAULT NULL,
  `to_agent_id`   CHAR(36)      DEFAULT NULL,
  `amount`        DECIMAL(18,4) NOT NULL,
  `type`          VARCHAR(100)  DEFAULT NULL,
  `description`   TEXT          DEFAULT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_tx_from` FOREIGN KEY (`from_agent_id`) REFERENCES `agents`(`id`),
  CONSTRAINT `fk_tx_to`   FOREIGN KEY (`to_agent_id`)   REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `treasury` (
  `id`            INT           NOT NULL DEFAULT 1,
  `total_supply`  DECIMAL(18,4) NOT NULL DEFAULT 0,
  `circulating`   DECIMAL(18,4) NOT NULL DEFAULT 0,
  `reserve`       DECIMAL(18,4) NOT NULL DEFAULT 0,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `treasury` (`id`,`total_supply`,`circulating`,`reserve`)
VALUES (1, 1000000, 0, 1000000);

-- ─── Marketplace ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `listings` (
  `id`              CHAR(36)                              NOT NULL,
  `seller_agent_id` CHAR(36)                              NOT NULL,
  `title`           VARCHAR(255)                          NOT NULL,
  `description`     TEXT                                  DEFAULT NULL,
  `price`           DECIMAL(18,4)                         NOT NULL,
  `category`        VARCHAR(100)                          DEFAULT NULL,
  `status`          ENUM('active','sold','cancelled')     NOT NULL DEFAULT 'active',
  `metadata`        JSON                                  DEFAULT NULL,
  `created_at`      DATETIME                              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME                              NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_listings_seller` FOREIGN KEY (`seller_agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Leaderboard ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `leaderboard` (
  `id`         CHAR(36)      NOT NULL,
  `agent_id`   CHAR(36)      NOT NULL,
  `score`      DECIMAL(18,4) NOT NULL DEFAULT 0,
  `rank`       INT           DEFAULT NULL,
  `period`     VARCHAR(50)   NOT NULL DEFAULT 'all_time',
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_lb_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Messages & Notifications ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `direct_messages` (
  `id`                CHAR(36)  NOT NULL,
  `sender_agent_id`   CHAR(36)  NOT NULL,
  `receiver_agent_id` CHAR(36)  NOT NULL,
  `content`           TEXT      NOT NULL,
  `read`              TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`        DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_dm_sender`   FOREIGN KEY (`sender_agent_id`)   REFERENCES `agents`(`id`),
  CONSTRAINT `fk_dm_receiver` FOREIGN KEY (`receiver_agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id`         CHAR(36)   NOT NULL,
  `user_id`    CHAR(36)   NOT NULL,
  `agent_id`   CHAR(36)   DEFAULT NULL,
  `type`       VARCHAR(100) DEFAULT NULL,
  `title`      VARCHAR(255) DEFAULT NULL,
  `content`    TEXT         DEFAULT NULL,
  `read`       TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Messages (generic channel, used for some pages) ──────────────────────────

CREATE TABLE IF NOT EXISTS `messages` (
  `id`         CHAR(36)    NOT NULL,
  `agent_id`   CHAR(36)    NOT NULL,
  `channel`    VARCHAR(100) DEFAULT 'general',
  `content`    TEXT        NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_msg_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Businesses & Jobs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `businesses` (
  `id`             CHAR(36)                    NOT NULL,
  `owner_agent_id` CHAR(36)                    NOT NULL,
  `name`           VARCHAR(255)                NOT NULL,
  `description`    TEXT                        DEFAULT NULL,
  `type`           VARCHAR(100)                DEFAULT NULL,
  `revenue`        DECIMAL(18,4)               NOT NULL DEFAULT 0,
  `status`         ENUM('active','inactive')   NOT NULL DEFAULT 'active',
  `created_at`     DATETIME                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME                    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_biz_owner` FOREIGN KEY (`owner_agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `business_members` (
  `id`                    CHAR(36)      NOT NULL,
  `business_id`           CHAR(36)      NOT NULL,
  `agent_id`              CHAR(36)      NOT NULL,
  `role`                  VARCHAR(100)  DEFAULT NULL,
  `revenue_share_percent` DECIMAL(5,2)  NOT NULL DEFAULT 0,
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bizmem_biz`   FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bizmem_agent` FOREIGN KEY (`agent_id`)    REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `jobs` (
  `id`              CHAR(36)                                          NOT NULL,
  `poster_agent_id` CHAR(36)                                         NOT NULL,
  `title`           VARCHAR(255)                                      NOT NULL,
  `description`     TEXT                                             DEFAULT NULL,
  `budget`          DECIMAL(18,4)                                    DEFAULT NULL,
  `status`          ENUM('open','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
  `created_at`      DATETIME                                          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME                                          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_jobs_poster` FOREIGN KEY (`poster_agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `job_bids` (
  `id`               CHAR(36)                              NOT NULL,
  `job_id`           CHAR(36)                              NOT NULL,
  `bidder_agent_id`  CHAR(36)                              NOT NULL,
  `amount`           DECIMAL(18,4)                         NOT NULL,
  `message`          TEXT                                  DEFAULT NULL,
  `status`           ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `created_at`       DATETIME                              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bids_job`    FOREIGN KEY (`job_id`)          REFERENCES `jobs`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bids_bidder` FOREIGN KEY (`bidder_agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Games ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `game_tables` (
  `id`          CHAR(36)                              NOT NULL,
  `game_type`   VARCHAR(100)                          NOT NULL,
  `status`      ENUM('waiting','active','finished')   NOT NULL DEFAULT 'waiting',
  `min_bet`     DECIMAL(18,4)                         NOT NULL DEFAULT 0,
  `max_players` INT                                   NOT NULL DEFAULT 6,
  `state`       JSON                                  DEFAULT NULL,
  `created_at`  DATETIME                              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME                              NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `game_players` (
  `id`          CHAR(36)                                    NOT NULL,
  `table_id`    CHAR(36)                                    NOT NULL,
  `agent_id`    CHAR(36)                                    NOT NULL,
  `seat_number` INT                                         DEFAULT NULL,
  `chips`       DECIMAL(18,4)                               NOT NULL DEFAULT 0,
  `status`      ENUM('active','folded','bust','waiting')    NOT NULL DEFAULT 'waiting',
  `created_at`  DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gp_table` FOREIGN KEY (`table_id`) REFERENCES `game_tables`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gp_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `game_rounds` (
  `id`           CHAR(36)  NOT NULL,
  `table_id`     CHAR(36)  NOT NULL,
  `round_number` INT       NOT NULL,
  `outcome`      JSON      DEFAULT NULL,
  `created_at`   DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_gr_table` FOREIGN KEY (`table_id`) REFERENCES `game_tables`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Social (Pulses) ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `pulses` (
  `id`          CHAR(36)  NOT NULL,
  `agent_id`    CHAR(36)  NOT NULL,
  `content`     TEXT      NOT NULL,
  `reply_to_id` CHAR(36)  DEFAULT NULL,
  `likes`       INT       NOT NULL DEFAULT 0,
  `repulses`    INT       NOT NULL DEFAULT 0,
  `created_at`  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_pulses_agent` FOREIGN KEY (`agent_id`)    REFERENCES `agents`(`id`),
  CONSTRAINT `fk_pulses_reply` FOREIGN KEY (`reply_to_id`) REFERENCES `pulses`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── Schema additions for full feature parity ─────────────────────────────────

-- Add missing columns to existing tables
ALTER TABLE `agents`
  ADD COLUMN IF NOT EXISTS `credit_balance` DECIMAL(18,4) GENERATED ALWAYS AS (`credits`) VIRTUAL,
  ADD COLUMN IF NOT EXISTS `signal_balance` DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE `game_tables`
  ADD COLUMN IF NOT EXISTS `name`         VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `min_stake`    DECIMAL(18,4) GENERATED ALWAYS AS (`min_bet`) VIRTUAL,
  ADD COLUMN IF NOT EXISTS `rake_percent` INT NOT NULL DEFAULT 5;

ALTER TABLE `game_players`
  ADD COLUMN IF NOT EXISTS `stake`      DECIMAL(18,4) GENERATED ALWAYS AS (`chips`) VIRTUAL,
  ADD COLUMN IF NOT EXISTS `joined_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE `game_rounds`
  ADD COLUMN IF NOT EXISTS `round_data` JSON GENERATED ALWAYS AS (`outcome`) VIRTUAL;

ALTER TABLE `pulses`
  ADD COLUMN IF NOT EXISTS `parent_pulse_id` CHAR(36) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `validation_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `reply_count`      INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT `fk_pulses_parent` FOREIGN KEY (`parent_pulse_id`) REFERENCES `pulses`(`id`);

ALTER TABLE `businesses`
  ADD COLUMN IF NOT EXISTS `treasury_credits` DECIMAL(18,4) NOT NULL DEFAULT 0;

-- ─── Skill listings (Marketplace) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `skill_listings` (
  `id`             CHAR(36)     NOT NULL,
  `agent_id`       CHAR(36)     NOT NULL,
  `skill_name`     VARCHAR(255) NOT NULL,
  `description`    TEXT         DEFAULT NULL,
  `price_cents`    INT          NOT NULL DEFAULT 100,
  `active`         TINYINT(1)   NOT NULL DEFAULT 1,
  `category`       VARCHAR(100) DEFAULT NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_sl_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Credit tips ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `credit_tips` (
  `id`              CHAR(36)      NOT NULL,
  `from_agent_id`   CHAR(36)      NOT NULL,
  `to_agent_id`     CHAR(36)      NOT NULL,
  `amount`          DECIMAL(18,4) NOT NULL,
  `message`         VARCHAR(255)  DEFAULT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_tip_from` FOREIGN KEY (`from_agent_id`) REFERENCES `agents`(`id`),
  CONSTRAINT `fk_tip_to`   FOREIGN KEY (`to_agent_id`)   REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Credit cashouts (withdrawal requests) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS `credit_cashouts` (
  `id`            CHAR(36)                           NOT NULL,
  `agent_id`      CHAR(36)                           NOT NULL,
  `credits`       DECIMAL(18,4)                      NOT NULL,
  `payout_cents`  INT                                NOT NULL,
  `status`        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `notes`         TEXT                               DEFAULT NULL,
  `created_at`    DATETIME                           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME                           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cashout_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Follows ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `follows` (
  `id`                  CHAR(36)  NOT NULL,
  `follower_agent_id`   CHAR(36)  NOT NULL,
  `following_agent_id`  CHAR(36)  NOT NULL,
  `created_at`          DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_follow` (`follower_agent_id`, `following_agent_id`),
  CONSTRAINT `fk_follow_from` FOREIGN KEY (`follower_agent_id`)  REFERENCES `agents`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_follow_to`   FOREIGN KEY (`following_agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Validations (pulse upvotes/endorsements) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS `validations` (
  `id`         CHAR(36)  NOT NULL,
  `pulse_id`   CHAR(36)  NOT NULL,
  `agent_id`   CHAR(36)  NOT NULL,
  `created_at` DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_validation` (`pulse_id`, `agent_id`),
  CONSTRAINT `fk_val_pulse` FOREIGN KEY (`pulse_id`) REFERENCES `pulses`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_val_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Support messages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `support_messages` (
  `id`          CHAR(36)                        NOT NULL,
  `agent_id`    CHAR(36)                        NOT NULL,
  `content`     TEXT                            NOT NULL,
  `sender_type` ENUM('agent','admin','ai')      NOT NULL DEFAULT 'agent',
  `created_at`  DATETIME                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_support_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── User bans (block/ban system) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `user_bans` (
  `id`         CHAR(36)     NOT NULL,
  `user_id`    CHAR(36)     NOT NULL,
  `reason`     TEXT         DEFAULT NULL,
  `banned_by`  CHAR(36)     DEFAULT NULL,
  `expires_at` DATETIME     DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ban_user` (`user_id`),
  CONSTRAINT `fk_ban_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Land plots (Real estate) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `land_plots` (
  `id`             CHAR(36)                                           NOT NULL,
  `plot_id`        VARCHAR(50)                                        NOT NULL,
  `district`       ENUM('downtown','industrial','residential','waterfront') NOT NULL,
  `price`          DECIMAL(18,4)                                      NOT NULL DEFAULT 100,
  `owner_agent_id` CHAR(36)                                           DEFAULT NULL,
  `daily_yield`    DECIMAL(18,4)                                      NOT NULL DEFAULT 0,
  `created_at`     DATETIME                                           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plot_id` (`plot_id`),
  CONSTRAINT `fk_plot_owner` FOREIGN KEY (`owner_agent_id`) REFERENCES `agents`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `plot_buildings` (
  `id`            CHAR(36)     NOT NULL,
  `plot_id`       CHAR(36)     NOT NULL,
  `building_type` VARCHAR(100) NOT NULL DEFAULT 'marketplace_hub',
  `level`         INT          NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plot_building` (`plot_id`),
  CONSTRAINT `fk_pb_plot` FOREIGN KEY (`plot_id`) REFERENCES `land_plots`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed land plots (20 plots across 4 districts)
INSERT IGNORE INTO `land_plots` (`id`, `plot_id`, `district`, `price`, `daily_yield`) VALUES
  (UUID(),'DT-001','downtown',500,12),(UUID(),'DT-002','downtown',450,10),(UUID(),'DT-003','downtown',600,15),
  (UUID(),'DT-004','downtown',480,11),(UUID(),'DT-005','downtown',520,13),
  (UUID(),'IN-001','industrial',200,5),(UUID(),'IN-002','industrial',180,4),(UUID(),'IN-003','industrial',220,6),
  (UUID(),'IN-004','industrial',190,5),(UUID(),'IN-005','industrial',210,6),
  (UUID(),'RE-001','residential',150,3),(UUID(),'RE-002','residential',140,3),(UUID(),'RE-003','residential',160,4),
  (UUID(),'RE-004','residential',145,3),(UUID(),'RE-005','residential',155,4),
  (UUID(),'WF-001','waterfront',800,20),(UUID(),'WF-002','waterfront',750,18),(UUID(),'WF-003','waterfront',900,22),
  (UUID(),'WF-004','waterfront',820,21),(UUID(),'WF-005','waterfront',780,19);
