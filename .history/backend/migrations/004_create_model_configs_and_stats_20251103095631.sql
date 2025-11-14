-- Migration 004: Create model_configs and system_stats tables
-- This migration adds support for storing AI model configurations and system statistics

-- Create model_configs table
CREATE TABLE IF NOT EXISTS model_configs (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    model_id VARCHAR(200) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(500),  -- Encrypted API key storage
    model_name VARCHAR(200),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    config_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on model_configs
CREATE INDEX IF NOT EXISTS idx_model_configs_active ON model_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_model_configs_provider ON model_configs(provider);
CREATE INDEX IF NOT EXISTS idx_model_configs_default ON model_configs(is_default) WHERE is_default = TRUE;

-- Create system_stats table
CREATE TABLE IF NOT EXISTS system_stats (
    id SERIAL PRIMARY KEY,
    stat_type VARCHAR(100) NOT NULL,  -- workflow, project, api_call, ai_model_usage, etc.
    stat_key VARCHAR(200) NOT NULL,   -- specific stat identifier
    stat_value FLOAT NOT NULL,        -- numeric value
    stat_metadata JSONB DEFAULT '{}', -- additional metadata
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes on system_stats
CREATE INDEX IF NOT EXISTS idx_system_stats_type ON system_stats(stat_type);
CREATE INDEX IF NOT EXISTS idx_system_stats_key ON system_stats(stat_key);
CREATE INDEX IF NOT EXISTS idx_system_stats_recorded_at ON system_stats(recorded_at);
CREATE INDEX IF NOT EXISTS idx_system_stats_active ON system_stats(is_active);

-- Insert default model configurations
INSERT INTO model_configs (id, name, model_id, provider, base_url, model_name, is_default, is_active)
VALUES 
    ('claude-sonnet', 'Claude 3.5 Sonnet', 'claude-3-5-sonnet-20241022', 'anthropic', 'https://api.anthropic.com/v1', 'claude-3-5-sonnet-20241022', TRUE, TRUE),
    ('gpt-4', 'GPT-4', 'gpt-4', 'openai', 'https://api.openai.com/v1', 'gpt-4', FALSE, TRUE),
    ('gpt-3.5-turbo', 'GPT-3.5 Turbo', 'gpt-3.5-turbo', 'openai', 'https://api.openai.com/v1', 'gpt-3.5-turbo', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Insert initial system statistics
INSERT INTO system_stats (stat_type, stat_key, stat_value)
VALUES 
    ('workflow', 'total', 0),
    ('project', 'active', 0),
    ('api_call', 'total', 0),
    ('ai_model_usage', 'claude', 0),
    ('ai_model_usage', 'gpt', 0);

COMMENT ON TABLE model_configs IS 'AI model configuration storage';
COMMENT ON TABLE system_stats IS 'System statistics and metrics tracking';
