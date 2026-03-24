-- Agent Automation Schema Additions (agent_automation.sql)
-- Add durable state, memory, plans, and action history for agent automation

CREATE TABLE IF NOT EXISTS `agent_state` (
  `agent_id`         CHAR(36)     NOT NULL,
  `role`             VARCHAR(50)  NOT NULL,
  `goals`            JSON         DEFAULT NULL,
  `reputation`       DECIMAL(8,2) NOT NULL DEFAULT 0,
  `activity_status`  ENUM('active','paused','failed') NOT NULL DEFAULT 'active',
  `last_action_at`   DATETIME     DEFAULT NULL,
  `next_action_at`   DATETIME     DEFAULT NULL,
  `memory_summary`   TEXT         DEFAULT NULL,
  `economic_prefs`   JSON         DEFAULT NULL,
  `allowed_actions`  JSON         DEFAULT NULL,
  `failure_count`    INT          NOT NULL DEFAULT 0,
  `last_error`       TEXT         DEFAULT NULL,
  `automation_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`agent_id`),
  CONSTRAINT `fk_agentstate_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agent_memory` (
  `id`         CHAR(36)     NOT NULL,
  `agent_id`   CHAR(36)     NOT NULL,
  `summary`    TEXT         DEFAULT NULL,
  `context`    JSON         DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agentmem_agent` (`agent_id`),
  CONSTRAINT `fk_agentmem_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agent_activity_log` (
  `id`           CHAR(36)     NOT NULL,
  `agent_id`     CHAR(36)     NOT NULL,
  `action_type`  VARCHAR(50)  NOT NULL,
  `details`      JSON         DEFAULT NULL,
  `result`       VARCHAR(50)  DEFAULT NULL,
  `error`        TEXT         DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agentact_agent` (`agent_id`),
  CONSTRAINT `fk_agentact_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agent_plans` (
  `id`           CHAR(36)     NOT NULL,
  `agent_id`     CHAR(36)     NOT NULL,
  `plan_json`    JSON         NOT NULL,
  `run_at`       DATETIME     NOT NULL,
  `status`       ENUM('pending','executed','failed') NOT NULL DEFAULT 'pending',
  `error`        TEXT         DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agentplan_agent` (`agent_id`),
  CONSTRAINT `fk_agentplan_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `agent_action_history` (
  `id`           CHAR(36)     NOT NULL,
  `agent_id`     CHAR(36)     NOT NULL,
  `action_type`  VARCHAR(50)  NOT NULL,
  `input_json`   JSON         DEFAULT NULL,
  `output_json`  JSON         DEFAULT NULL,
  `status`       ENUM('success','failure') NOT NULL,
  `error`        TEXT         DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agentacthist_agent` (`agent_id`),
  CONSTRAINT `fk_agentacthist_agent` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
