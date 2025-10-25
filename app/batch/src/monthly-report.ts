/**
 * Monthly Report Batch
 * 月次集計レポート生成
 */

import dotenv from 'dotenv';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { Pool } from 'pg';
import { createDbPool, closeDbPool } from './lib/db';
import { uploadToS3 } from './lib/s3';
import { generateCSV } from './lib/csv';

dotenv.config();

interface MonthlyReportData {
  equipment_id: number;
  equipment_name: string;
  category: string;
  total_orders: number;
  total_amount: number;
  maintenance_count: number;
}

async function generateMonthlyReport(pool: Pool, year: number, month: number): Promise<string> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const query = `
    SELECT
      e.equipment_id,
      e.equipment_name,
      e.category,
      COALESCE(COUNT(DISTINCT o.order_id), 0) AS total_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_amount,
      COALESCE(COUNT(DISTINCT mr.report_id), 0) AS maintenance_count
    FROM equipment e
    LEFT JOIN order_items oi ON e.equipment_id = oi.equipment_id
    LEFT JOIN orders o ON oi.order_id = o.order_id
      AND o.order_date >= $1
      AND o.order_date < $2
    LEFT JOIN maintenance_reports mr ON e.equipment_id = mr.equipment_id
      AND mr.report_date >= $1
      AND mr.report_date < $2
    GROUP BY e.equipment_id, e.equipment_name, e.category
    ORDER BY e.category, e.equipment_name;
  `;

  try {
    const result = await pool.query<MonthlyReportData>(query, [startDate, endDate]);
    return generateCSV(result.rows);
  } catch (error) {
    console.error('Failed to generate monthly report:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .option('year', {
      type: 'number',
      description: 'Year (YYYY)',
      demandOption: true,
    })
    .option('month', {
      type: 'number',
      description: 'Month (1-12)',
      demandOption: true,
    })
    .help()
    .parse();

  const { year, month } = argv;

  if (month < 1 || month > 12) {
    console.error('Error: Month must be between 1 and 12');
    process.exit(1);
  }

  console.log(`Starting monthly report generation for ${year}-${month}...`);

  let pool: Pool | undefined;

  try {
    pool = await createDbPool();

    // Generate CSV report
    const csvData = await generateMonthlyReport(pool, year, month);

    // Upload to S3
    const bucket = process.env.S3_REPORTS_BUCKET || 'facility-prod-reports';
    const key = `monthly-reports/${year}/${String(month).padStart(2, '0')}/report.csv`;

    await uploadToS3({
      bucket,
      key,
      body: csvData,
      contentType: 'text/csv',
    });

    console.log(`Monthly report for ${year}-${month} completed successfully`);
  } catch (error) {
    console.error('Monthly report generation failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await closeDbPool(pool);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { generateMonthlyReport };
