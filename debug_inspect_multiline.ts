import { format } from './tests/utils';

async function run() {
  const code = `<div class="
    flex p-4
    bg-red-500
  "></div>`;

  const result = await format(code, {
    parser: 'html',
    // @ts-ignore
    tailwindMultiline: true
  });
  console.log('Result Multiline:', result);
}

run();
