import { format } from './tests/utils';

async function run() {
  const code = `<div class="
    flex p-4
    bg-red-500
  "></div>`;

  // Test with 'html' parser and default settings
  const result = await format(code, {
    parser: 'html',
    tailwindAttributes: ['class']
  });
  console.log('Result:', result);
}

run();
