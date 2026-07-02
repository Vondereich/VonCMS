const { spawnSync } = require('child_process');

const steps = [
  ['TypeScript check', 'npm', ['run', 'typecheck']],
  ['Prettier write', 'npx', ['prettier', '--write', '.']],
  ['BOM scan', 'node', ['remove-bom.cjs']],
  ['Vite build', 'npm', ['run', 'build']],
  ['Integration smoke', 'npm', ['run', 'test:integration']],
  ['PHP lint', 'npm', ['run', 'lint:php']],
  ['Create release ZIPs', 'node', ['create_release.cjs']],
];

for (const [index, [label, command, args]] of steps.entries()) {
  console.log(`\n[${index + 1}/${steps.length}] ${label}`);
  console.log(`> ${[command, ...args].join(' ')}`);

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    console.error(`\nRelease sequence failed at step ${index + 1}: ${label}`);
    process.exit(result.status || 1);
  }
}

console.log('\nRelease sequence completed.');
