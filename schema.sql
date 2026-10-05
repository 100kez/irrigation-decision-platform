-- 灌溉决策平台 数据库建表脚本
-- 数据库类型: PostgreSQL 14+
-- 使用方式: psql -U <user> -d <database> -f schema.sql

-- 自定义类型: user_profile (用户信息复合类型)
DO $$ BEGIN
  CREATE TYPE user_profile AS (
    user_id text,
    name text,
    avatar text,
    en_name text
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 自定义类型: file_attachment (文件附件复合类型)
DO $$ BEGIN
  CREATE TYPE file_attachment AS (
    bucket_id text,
    file_path text
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 农场表
-- ============================================================
CREATE TABLE IF NOT EXISTS farm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  longitude NUMERIC NOT NULL,
  latitude NUMERIC NOT NULL,
  crop_type VARCHAR(50) NOT NULL,
  sowing_date DATE NOT NULL,
  soil_type VARCHAR(50) NOT NULL,
  area NUMERIC NOT NULL,
  irrigation_method VARCHAR(50) NOT NULL,
  field_capacity NUMERIC NOT NULL DEFAULT 30.0,
  wilting_point NUMERIC NOT NULL DEFAULT 10.0,
  stress_threshold NUMERIC NOT NULL DEFAULT 18.0,
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);

CREATE INDEX IF NOT EXISTS idx_farm_created_at ON farm(_created_at);

-- ============================================================
-- 灌溉决策表
-- ============================================================
CREATE TABLE IF NOT EXISTS irrigation_decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farm(id) ON DELETE CASCADE,
  soil_moisture NUMERIC NOT NULL,
  soil_temperature NUMERIC NOT NULL,
  air_temperature NUMERIC NOT NULL,
  air_humidity NUMERIC NOT NULL,
  weather_data JSONB NOT NULL,
  water_storage_daily JSONB NOT NULL,
  water_risk_level VARCHAR(20) NOT NULL,
  stress_forecast_date DATE,
  irrigation_plan JSONB NOT NULL,
  -- AI 诊断判据: [{ type, label, description, impact }]
  ai_diagnostic_criteria JSONB NOT NULL DEFAULT '[]',
  -- AI 诊断摘要
  ai_diagnostic_summary TEXT,
  -- AI 对话历史: [{ role, content, imageUrls? }]
  ai_chat_messages JSONB NOT NULL DEFAULT '[]',
  -- 方案状态: pending 待确认 / adopted 已采纳 / executed 已执行 / rejected 暂不执行 / superseded 已替代
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 实际执行记录: [{ executedAt, amountMm, amountM3, note }]
  execution_records JSONB NOT NULL DEFAULT '[]',
  -- 人工调整后的灌溉方案(与原 irrigation_plan 对照)
  adjusted_plan JSONB,
  -- 生成决策时的 AI 模型名
  ai_model VARCHAR(50),
  _created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _created_by user_profile,
  _updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  _updated_by user_profile
);

CREATE INDEX IF NOT EXISTS idx_irrigation_decision_farm_id ON irrigation_decision(farm_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_decision_created_at ON irrigation_decision(_created_at);

-- ============================================================
-- RLS 行级安全策略 (可选, 根据部署需求启用)
-- 本地部署如不需要多用户隔离, 可跳过以下 ALTER 语句
-- ============================================================
-- ALTER TABLE farm ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE irrigation_decision ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY farm_all ON farm FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY irrigation_decision_all ON irrigation_decision FOR ALL USING (true) WITH CHECK (true);
