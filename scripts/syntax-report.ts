#!/usr/bin/env tsx

/**
 * Syntax Report Generator
 * Analyzes the codebase for syntax errors and generates a detailed report
 */

import { syntaxGuardian } from '../src/services/syntax-guardian';
import * as fs from 'fs';
import * as path from 'path';

async function generateReport() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('📊 Generating Syntax Report...\n');

  const report = await syntaxGuardian.generateReport();

  // Save report
  const reportPath = path.join(process.cwd(), 'SYNTAX_REPORT.md');
  await fs.promises.writeFile(reportPath, report);

  console.log(report);
  console.log(`\n✅ Report saved to: ${reportPath}`);
}

generateReport().catch(console.error);
