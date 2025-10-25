/**
 * Annual Report Batch
 * 年次集計レポート生成
 */

import dotenv from 'dotenv';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { Pool } from 'pg';
import { createDbPool, closeDbPool } from './lib/db';
import { uploadToS3 } from './lib/s3';
import { generateCSV } from './lib/csv';

dotenv.config();

interface AnnualReportData {
  equipment_id: number;
  equipment_name: string;
  category: string;
  years_since_purchase: number;
  total_orders_year: number;
  total_amount_year: number;
  total_maintenance_year: number;
  avg_maintenance_interval_days: number | null;
}

async function generateAnnualReport(pool: Pool, year: number): Promise<string> {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const query = `
    SELECT
      e.equipment_id,
      e.equipment_name,
      e.category,
      EXTRACT(YEAR FROM AGE($1::date, e.purchase_date))::integer AS years_since_purchase,
      COALESCE(COUNT(DISTINCT o.order_id), 0) AS total_orders_year,
      COALESCE(SUM(o.total_amount), 0) AS total_amount_year,
      COALESCE(COUNT(DISTINCT mr.report_id), 0) AS total_maintenance_year,
      CASE
        WHEN COUNT(DISTINCT mr.report_id) > 1 THEN
          EXTRACT(EPOCH FROM (MAX(mr.report_date) - MIN(mr.report_date))) / 86400 / (COUNT(DISTINCT mr.report_id) - 1)
        ELSE NULL
      END AS avg_maintenance_interval_days
    FROM equipment e
    LEFT JOIN order_items oi ON e.equipment_id = oi.equipment_id
    LEFT JOIN orders o ON oi.order_id = o.order_id
      AND o.order_date >= $1
      AND o.order_date < $2
    LEFT JOIN maintenance_reports mr ON e.equipment_id = mr.equipment_id
      AND mr.report_date >= $1
      AND mr.report_date < $2
    GROUP BY e.equipment_id, e.equipment_name, e.category, e.purchase_date
    ORDER BY years_since_purchase DESC, e.category, e.equipment_name;
  `;

  try {
    const result = await pool.query<AnnualReportData>(query, [startDate, endDate]);
    return generateCSV(result.rows);
  } catch (error) {
    console.error('Failed to generate annual report:', error);
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
    .help()
    .parse();

  const { year } = argv;

  console.log(`Starting annual report generation for ${year}...`);

  let pool: Pool | undefined;

  try {
    pool = await createDbPool();

    // Generate CSV report
    const csvData = await generateAnnualReport(pool, year);

    // Upload to S3
    const bucket = process.env.S3_REPORTS_BUCKET || 'facility-prod-reports';
    const key = `annual-reports/${year}/report.csv`;

    await uploadToS3({
      bucket,
      key,
      body: csvData,
      contentType: 'text/csv',
    });

    console.log(`Annual report for ${year} completed successfully`);
  } catch (error) {
    console.error('Annual report generation failed:', error);
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

export { generateAnnualReport };
