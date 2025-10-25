/**
 * 統合テスト用セットアップ
 * Testcontainersを使用してPostgreSQLコンテナを起動
 */

import { Pool } from 'pg';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

let postgresContainer: StartedTestContainer;
let testPool: Pool;

/**
 * テスト用PostgreSQLコンテナの起動とスキーマ初期化
 */
export async function setupTestDatabase(): Promise<Pool> {
  console.log('Starting PostgreSQL container...');

  // PostgreSQL 14コンテナの起動
  postgresContainer = await new GenericContainer('postgres:14-alpine')
    .withEnvironment({
      POSTGRES_USER: 'testuser',
      POSTGRES_PASSWORD: 'testpass',
      POSTGRES_DB: 'facility_db_test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
    .withStartupTimeout(60000)
    .start();

  const host = postgresContainer.getHost();
  const port = postgresContainer.getMappedPort(5432);

  console.log(`PostgreSQL container started at ${host}:${port}`);

  // DB接続プールの作成
  testPool = new Pool({
    host,
    port,
    user: 'testuser',
    password: 'testpass',
    database: 'facility_db_test',
  });

  // スキーマ初期化
  await initializeSchema(testPool);

  return testPool;
}

/**
 * テスト用スキーマの初期化
 */
async function initializeSchema(pool: Pool): Promise<void> {
  console.log('Initializing database schema...');

  // テーブル作成（基本設計書のスキーマ定義に基づく）
  await pool.query(`
    -- 1. 会社テーブル
    CREATE TABLE companies (
      company_id SERIAL PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(100),
      phone VARCHAR(20),
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. 設備テーブル
    CREATE TABLE equipment (
      equipment_id SERIAL PRIMARY KEY,
      equipment_name VARCHAR(255) NOT NULL,
      model_number VARCHAR(100),
      category VARCHAR(50) NOT NULL,
      quantity INTEGER DEFAULT 1,
      storage_location VARCHAR(255),
      purchase_date DATE,
      company_id INTEGER REFERENCES companies(company_id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );

    -- 3. 保守報告テーブル
    CREATE TABLE maintenance_reports (
      report_id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL REFERENCES equipment(equipment_id),
      company_id INTEGER NOT NULL REFERENCES companies(company_id),
      report_date DATE NOT NULL,
      description TEXT,
      next_maintenance_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. インデックス
    CREATE INDEX idx_equipment_company ON equipment(company_id);
    CREATE INDEX idx_equipment_category ON equipment(category);
    CREATE INDEX idx_maintenance_equipment ON maintenance_reports(equipment_id);
    CREATE INDEX idx_maintenance_company ON maintenance_reports(company_id);

    -- 5. Row-Level Security (RLS) の設定
    ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
    ALTER TABLE maintenance_reports ENABLE ROW LEVEL SECURITY;

    -- RLSポリシー（company_idで制限）
    CREATE POLICY equipment_company_policy ON equipment
      FOR ALL
      USING (company_id = current_setting('app.company_id', true)::INTEGER);

    CREATE POLICY maintenance_company_policy ON maintenance_reports
      FOR ALL
      USING (company_id = current_setting('app.company_id', true)::INTEGER);
  `);

  console.log('Database schema initialized successfully');
}

/**
 * テストデータの投入
 */
export async function seedTestData(pool: Pool): Promise<void> {
  console.log('Seeding test data...');

  // 1. 会社データ
  await pool.query(`
    INSERT INTO companies (company_id, company_name, contact_person, phone, email)
    VALUES
      (1, 'Test Company A', 'John Doe', '03-1234-5678', 'john@companyA.com'),
      (2, 'Test Company B', 'Jane Smith', '03-8765-4321', 'jane@companyB.com');
  `);

  // 2. 設備データ
  await pool.query(`
    INSERT INTO equipment (equipment_id, equipment_name, model_number, category, quantity, storage_location, purchase_date, company_id)
    VALUES
      (1, 'Air Conditioner', 'AC-100', 'HVAC', 5, 'Building A', '2023-01-01', 1),
      (2, 'Fire Extinguisher', 'FE-200', 'Safety', 10, 'Building B', '2023-02-01', 1),
      (3, 'Elevator Motor', 'EM-300', 'Elevator', 2, 'Building C', '2023-03-01', 2);
  `);

  // 3. 保守報告データ
  await pool.query(`
    INSERT INTO maintenance_reports (equipment_id, company_id, report_date, description, next_maintenance_date)
    VALUES
      (1, 1, '2024-01-15', 'Routine inspection completed', '2024-02-15'),
      (1, 1, '2024-02-15', 'Filter replacement', '2024-03-15'),
      (2, 1, '2024-01-20', 'Pressure check completed', '2024-07-20');
  `);

  console.log('Test data seeded successfully');
}

/**
 * テスト用データベースのクリーンアップ
 */
export async function teardownTestDatabase(): Promise<void> {
  console.log('Tearing down test database...');

  if (testPool) {
    await testPool.end();
  }

  if (postgresContainer) {
    await postgresContainer.stop();
    console.log('PostgreSQL container stopped');
  }
}

/**
 * 各テストケース前のデータクリア
 */
export async function clearTestData(pool: Pool): Promise<void> {
  await pool.query('TRUNCATE TABLE maintenance_reports, equipment, companies RESTART IDENTITY CASCADE;');
}
