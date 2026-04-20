#!/usr/bin/env node
/**
 * ORS Crawl Entry Point
 * Usage:
 *   node scripts/crawl_ors.js --country=ES
 *   node scripts/crawl_ors.js --country=ES --dry-run --max-prefixes=3
 *   node scripts/crawl_ors.js --all
 *
 * Spec: docs/ORS_CRAWL_SPEC.md §7, §10
 */
require('dotenv').config();
const path = require('path');
const ors = require('../node/src/modules/entities/ors_client');
const crawler = require('../node/src/modules/entities/ors_crawler');
const pool = require('../node/src/utils/db');

const priorityCountries = require('./ors_priority_countries.json');

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      args[key] = val === undefined ? true : val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const dryRun = !!args['dry-run'];
  const maxPrefixes = args['max-prefixes'] ? parseInt(args['max-prefixes'], 10) : (dryRun ? 3 : Infinity);

  console.log('=== ORS Crawl ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'FULL'}`);
  if (maxPrefixes !== Infinity) console.log(`Max prefixes per country: ${maxPrefixes}`);

  // Fetch country taxonomy
  console.log('Fetching country taxonomy...');
  let countries;
  try {
    countries = await ors.getCountries();
    const countryCount = Array.isArray(countries) ? countries.length : Object.keys(countries).length;
  console.log(`  Got ${countryCount} countries from ORS`);
  } catch (err) {
    console.error(`FATAL: Cannot fetch country taxonomy: ${err.message}`);
    process.exit(1);
  }

  const isoToTax = crawler.buildISOToTaxMap(countries);
  const countryMap = crawler.buildCountryMap(countries);

  // Determine which countries to crawl
  let targetCountries = [];

  if (args.country) {
    const iso = args.country.toUpperCase();
    const taxId = isoToTax.get(iso);
    if (!taxId) {
      console.error(`ERROR: Country ${iso} not found in ORS taxonomy.`);
      console.log('Available:', [...isoToTax.keys()].sort().join(', '));
      process.exit(1);
    }
    targetCountries = [{ iso, taxId }];
  } else if (args.all) {
    targetCountries = priorityCountries
      .map(c => ({ iso: c.iso, taxId: isoToTax.get(c.iso) }))
      .filter(c => {
        if (!c.taxId) {
          console.warn(`  WARNING: ${c.iso} not found in taxonomy, skipping`);
          return false;
        }
        return true;
      });
  } else {
    console.error('Usage: --country=ES or --all');
    console.error('Options: --dry-run --max-prefixes=N');
    process.exit(1);
  }

  console.log(`Crawling ${targetCountries.length} country(s): ${targetCountries.map(c => c.iso).join(', ')}`);
  console.log('');

  // Crawl each country
  for (const { iso, taxId } of targetCountries) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Country: ${iso} (taxId: ${taxId})`);
    console.log('='.repeat(50));

    try {
      const result = await crawler.crawlCountry(taxId, iso, { dryRun, maxPrefixes });

      // Print summary
      const progress = await crawler.getProgress(taxId);
      console.log(`\nSummary for ${iso}:`);
      console.log(`  Prefixes: ${progress.total_prefixes} total, ${progress.done} done, ${progress.capped} capped, ${progress.errors} errors`);

      // Count entities
      const [entRows] = await pool.execute(
        'SELECT COUNT(*) AS cnt FROM entities WHERE country_code = ?',
        [iso]
      );
      console.log(`  Entities in DB: ${entRows[0].cnt}`);
    } catch (err) {
      console.error(`ERROR crawling ${iso}: ${err.message}`);
    }
  }

  console.log('\n=== Crawl finished ===');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
