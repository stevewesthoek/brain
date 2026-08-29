import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const scriptPath = `${root}/tools/scripts/supabase-recovery-copy-backup.sh`;
const inventoryPath = `${root}/operations/infrastructure/catalog/supabase-logical-backup-databases.v1.json`;
const script = fs.readFileSync(scriptPath, 'utf8');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

test('recovery-copy runner is explicitly gated and isolated', () => {
  assert.match(script, /MODE="dry-run"/);
  assert.match(script, /--run\) MODE="run"/);
  assert.match(script, /--restore-mode AlternateLocation/);
  assert.doesNotMatch(script, /--restore-mode (?:OriginalLocation|ReplaceDisks)/);
  assert.match(script, /--target-resource-group/);
  assert.match(script, /--target-vnet-name/);
  assert.match(script, /--target-subnet-name/);
  assert.match(script, /detach_temporary_public_ips/);
  assert.match(script, /--remove publicIpAddress/);
  assert.match(script, /network nic show -g/);
  assert.match(script, /remote_stage_b64/);
  assert.ok(script.includes("tr -d '\\n=' | tr '+/' '-_'"));
  assert.match(script, /stage_init_path/);
  assert.match(script, /chunk_script_path/);
  assert.doesNotMatch(script, /--parameters/);
  assert.match(script, /base64 -d/);
  assert.match(script, /isolated_script_stage_chunk_failed/);
  assert.match(script, /contains\("RESULT status="\)/);
  assert.match(script, /restored_copy_has_public_ip/);
  assert.match(script, /restored_copy_has_vnet_peering/);
  assert.match(script, /temporary_resource_group_identity_mismatch/);
  assert.match(script, /Microsoft\.Network\/publicIPAddresses/);
  assert.match(script, /If-None-Match: \*/);
  assert.match(script, /curl --config -/);
  assert.match(script, /idempotency_state="ELIGIBLE"/);
  assert.match(script, /recovery_point_already_processed/);
  assert.match(script, /rm -rf -- "\$WORK_DIR"/);
  assert.match(script, /productionLogicalDumpUsed: false/);
  assert.match(script, /productionTouched: false/);
});

test('canonical database inventory contains exactly the proven 27 names', () => {
  assert.equal(inventory.databaseCount, 27);
  assert.equal(inventory.databases.length, 27);
  assert.equal(new Set(inventory.databases).size, 27);
  assert.ok(inventory.databases.includes('finance\\'));
  assert.ok(inventory.databases.includes('jpvbootcamp'));
  assert.ok(inventory.databases.includes('jpvbootcamp_legacy'));
  assert.ok(inventory.databases.includes('jpvbootcamp_staging'));
  assert.match(script, /EXPECTED_DATABASE_COUNT=27/);
  assert.match(script, /EXPECTED_REMOTE_OBJECT_COUNT=.*EXPECTED_DATABASE_COUNT \+ 3/);
  assert.match(script, /expected_databases=\(/);
});

test('archive validation stays file-native inside the database container', () => {
  assert.match(script, /--file=\"\$container_dump_file\"/);
  assert.match(script, /db_exec pg_restore --list \"\$container_dump_file\"/);
  assert.match(script, /docker cp \"supabase-db:\$\{container_dump_file\}\" \"\$dump_file\"/);
  assert.doesNotMatch(script, /cat \"\$dump_file\" \| db_exec(?:_with_stdin)? pg_restore --list/);
});

test('backup CONNECT access is gated and reconciled only on the recovery copy', () => {
  assert.match(script, /BACKUP_ROLE=.*postgres/);
  assert.match(script, /connect_matrix\(\)/);
  assert.match(script, /has_database_privilege\(current_user, e\.datname, 'CONNECT'\)/);
  assert.match(script, /backup_connect_matrix_incomplete/);
  assert.match(script, /reconcile_recovery_copy_connect\(\)/);
  assert.match(script, /db_admin_psql\(\).*supabase_admin/);
  assert.match(script, /GRANT CONNECT ON DATABASE/);
  assert.match(script, /connect-matrix-before\.tsv/);
  assert.match(script, /connect-matrix-after\.tsv/);
  const matrixSection = script.slice(script.indexOf('connect_matrix()'), script.indexOf('reconcile_recovery_copy_connect()'));
  for (const database of inventory.databases) {
    const marker = database === 'finance\\' ? "('finance' || chr(92))" : `('${database}')`;
    assert.match(matrixSection, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.ok(script.indexOf('connect_matrix > "$WORK_DIR/connect-matrix-before.tsv"') < script.indexOf('db_exec pg_dumpall -U "$BACKUP_ROLE"'));
  assert.doesNotMatch(script, /production.*GRANT CONNECT/i);
});

test('remote object count includes all 27 dumps and three metadata objects', () => {
  assert.match(script, /REMOTE_OBJECT_COUNT.*EXPECTED_REMOTE_OBJECT_COUNT/);
  assert.doesNotMatch(script, /REMOTE_OBJECT_COUNT.*== 29/);
  assert.match(script, /globals\.sql/);
  assert.match(script, /recovery-manifest\.tsv/);
  assert.match(script, /sha256sums\.txt/);
});

test('CONNECT reconciliation preserves shell dollar-quote and catalog backslash arguments', () => {
  const oldShell = String.raw`old="DO \\$\\$;"; test "$old" = 'DO $$;'`;
  assert.throws(() => execFileSync('/bin/bash', ['-c', oldShell], { encoding: 'utf8' }));

  const fixedShell = String.raw`fixed="DO \$\$;"; test "$fixed" = 'DO $$;'`;
  execFileSync('/bin/bash', ['-c', fixedShell], { encoding: 'utf8' });

  const catalogValue = execFileSync('/bin/bash', ['-c', String.raw`value='finance\'; final_consumer() { test "$1" = 'finance\'; }; final_consumer "$value"`], { encoding: 'utf8' });
  assert.equal(catalogValue, '');
});

test('runner keeps the approved secret and legacy boundaries', () => {
  assert.match(script, /container\.sas/);
  assert.match(script, /SAS_FILE_INPUT=/);
  assert.match(script, /printf \'blob_sas=%q/);
  assert.match(script, /--scripts "@\$secret_wrapper_path"/);
  assert.match(script, /unset existing_sas/);
  assert.doesNotMatch(script, /--parameters[^\n]*(?:existing_sas|BLOB_SAS|sas)/);
  assert.doesNotMatch(script, /azcopy\s+(?:copy|list)/);
  assert.doesNotMatch(script, /printf.*\$sas|echo.*\$sas|log.*\$sas/);
  assert.match(script, /pgdump-upload\.timer/);
  assert.doesNotMatch(script, /systemctl\s+(?:enable|start)\s+pgdump-upload/);
  assert.doesNotMatch(script, /docker\s+system\s+prune/);
  assert.doesNotMatch(script, /azcopy\s+remove|azcopy\s+delete/);
});

test('synthetic SAS sentinel stays out of argv, logs, state, and dry-run materialization', () => {
  const sentinel = 'sv=2026-02-06&sp=rcwl&sr=c&sig=phase3x-synthetic-sentinel';
  const safeArgv = ['vm', 'run-command', 'invoke', '--scripts', '@/private/remote-final-wrapper.sh'];
  const safeLog = 'BACKUP_RESULT=PASS run_id=synthetic remote_crypto=PARTIAL';
  const safeState = JSON.stringify({ status: 'SUCCESS', sourceKind: 'durable-supabase-recovery-copy' });
  const dryRunSection = script.slice(script.indexOf('if [[ "$MODE" == "dry-run" ]]'), script.indexOf('RUN_STARTED_AT='));
  assert.doesNotMatch(script, new RegExp(sentinel));
  assert.doesNotMatch(safeArgv.join(' '), new RegExp(sentinel));
  assert.doesNotMatch(safeLog, new RegExp(sentinel));
  assert.doesNotMatch(safeState, new RegExp(sentinel));
  assert.doesNotMatch(dryRunSection, /container\.sas|existing_sas|BLOB_SAS/);
});
