export const REPORTER_CONFIG_PATH='/home/player/practice/reporterd.conf';
/** Training-only service config with one deliberately invalid directive. */
export const REPORTER_CONFIG_CONTENT=[
  '# reporter.service - konfiguracja treningowa',
  '# dostępne klucze: format, output_path, retry_limit',
  'format=csv',
  'output_dir=/var/reports',
  'retry_limit=3'
].join('\n')+'\n';
