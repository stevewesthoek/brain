import path from 'node:path';
import process from 'node:process';
import { loadAndValidateReferenceCatalog } from './infrastructure-catalog/catalog-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const result = loadAndValidateReferenceCatalog(root, new Date('2026-08-16T20:00:00Z'));
for (const warning of result.warnings) console.warn(`WARN ${warning}`);
if (result.errors.length > 0) {
  for (const error of result.errors) console.error(`ERROR ${error}`);
  process.exit(1);
}
const c = result.counts;
console.log(`infrastructure-catalog-valid schema=${result.schemaId} resources=${c.resources} relations=${c.relations} bindings=${c.serviceBindings} accessRefs=${c.accessReferences} backupPolicies=${c.backupPolicies} healthPolicies=${c.healthPolicies} safetyPolicies=${c.safetyPolicies} resourceClasses=${c.resourceClasses} mappingSources=${result.mappingSources} staleWarnings=${c.staleWarnings}`);
