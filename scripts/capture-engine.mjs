import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const transport = new StdioClientTransport({ command: process.argv[2], args: ['serve', '--repo', process.cwd()], stderr: 'pipe' });
transport.stderr?.on('data', () => {});
const client = new Client({ name: 'dsh-crg-capabilities', version: '0.1.0' });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const { prompts } = await client.listPrompts();
  console.log(JSON.stringify({ tools, prompts }, null, 2));
} finally { await client.close(); }
