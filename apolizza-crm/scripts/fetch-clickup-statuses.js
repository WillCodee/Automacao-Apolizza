#!/usr/bin/env node
/**
 * Busca todos os status disponíveis na lista do ClickUp
 */

require('dotenv').config({ path: '.env.local' });

const listId = process.env.CLICKUP_LIST_ID || '900701916229';
const token = process.env.CLICKUP_API_TOKEN;

if (!token) {
  console.error('❌ CLICKUP_API_TOKEN não definido em .env.local');
  process.exit(1);
}

async function fetchStatuses() {
  try {
    const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
      headers: { 'Authorization': token }
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    console.log('═'.repeat(70));
    console.log('  STATUS DISPONÍVEIS NA LISTA DO CLICKUP');
    console.log('═'.repeat(70));
    console.log(`  Lista: ${data.name || listId}`);
    console.log('');

    if (data.statuses && data.statuses.length > 0) {
      console.log(`  Total de status: ${data.statuses.length}\n`);

      data.statuses.forEach((s, i) => {
        console.log(`${(i+1).toString().padStart(2)}. ${s.status.padEnd(30)} | ${s.color.padEnd(10)} | ${s.type.padEnd(10)} | order: ${s.orderindex}`);
      });

      console.log('\n' + '─'.repeat(70));
      console.log('  STATUS COMO ARRAY TYPESCRIPT:\n');
      const statusArray = data.statuses.map(s => `  "${s.status}",`).join('\n');
      console.log('export const STATUS_OPTIONS = [');
      console.log(statusArray);
      console.log('] as const;');

    } else {
      console.log('❌ Nenhum status encontrado');
      console.log('\nEstrutura recebida:');
      console.log(JSON.stringify(data, null, 2));
    }

    console.log('═'.repeat(70));
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

fetchStatuses();
