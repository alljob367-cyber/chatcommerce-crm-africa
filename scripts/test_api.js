const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 15000,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data, raw: true }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const BASE = 'http://localhost:3000';
  let TOKEN;
  const results = [];

  console.log('=== ChatCommerce CRM - Test Complet ===\n');

  // 1. Auth
  try {
    const r = await fetch(`${BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { action: 'demo' }
    });
    TOKEN = r.data.token;
    results.push(['AUTH (demo login)', r.status === 200, `User: ${r.data.user?.name}`]);
  } catch (e) {
    results.push(['AUTH (demo login)', false, e.message]);
    console.log('Server not reachable. Start it first.');
    process.exit(1);
  }

  const authHeaders = { Authorization: `Bearer ${TOKEN}` };

  // 2. Auth validation
  try {
    const r = await fetch(`${BASE}/api/auth`, { headers: authHeaders });
    results.push(['AUTH (validation)', r.status === 200, `User: ${r.data.user?.name}, Company: ${r.data.user?.company?.name}`]);
  } catch (e) { results.push(['AUTH (validation)', false, e.message]); }

  // 3. Dashboard
  try {
    const r = await fetch(`${BASE}/api/dashboard`, { headers: authHeaders });
    const k = r.data.kpis;
    results.push(['DASHBOARD', r.status === 200, `Contacts:${k.totalContacts} Orders:${k.totalOrders} Revenue:${k.totalRevenue} Msgs:${k.totalMessages}`]);
  } catch (e) { results.push(['DASHBOARD', false, e.message]); }

  // 4. Contacts
  try {
    const r = await fetch(`${BASE}/api/contacts`, { headers: authHeaders });
    results.push(['CONTACTS (list)', r.status === 200, `Total: ${r.data.total}`]);
  } catch (e) { results.push(['CONTACTS (list)', false, e.message]); }

  // 5. Create Contact
  try {
    const r = await fetch(`${BASE}/api/contacts`, {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: { name: 'Client Test', phone: '+237699988877', city: 'Douala', tags: 'test' }
    });
    const ok = r.status === 201 || r.status === 409; // 409 = already exists is also OK
    results.push(['CONTACTS (create)', ok, `Status: ${r.status}, Name: ${r.data.contact?.name || r.data.error}`]);
  } catch (e) { results.push(['CONTACTS (create)', false, e.message]); }

  // 6. Conversations
  let convId;
  try {
    const r = await fetch(`${BASE}/api/conversations`, { headers: authHeaders });
    convId = r.data.conversations?.[0]?.id;
    results.push(['CONVERSATIONS (list)', r.status === 200, `Total: ${r.data.total}`]);
  } catch (e) { results.push(['CONVERSATIONS (list)', false, e.message]); }

  // 7. Messages
  if (convId) {
    try {
      const r = await fetch(`${BASE}/api/conversations/messages?conversationId=${convId}`, { headers: authHeaders });
      results.push(['MESSAGES (list)', r.status === 200, `Total: ${r.data.total}`]);
    } catch (e) { results.push(['MESSAGES (list)', false, e.message]); }
  } else {
    results.push(['MESSAGES (list)', false, 'No conversation ID']);
  }

  // 8. Send message
  if (convId) {
    try {
      const contactId = (await fetch(`${BASE}/api/contacts`, { headers: authHeaders })).data.contacts?.[0]?.id;
      if (contactId) {
        const r = await fetch(`${BASE}/api/conversations`, {
          method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: { contactId, message: 'Message test CRM' }
        });
        results.push(['CONVERSATIONS (send msg)', r.status === 200, `Msg: ${(r.data.message?.body || '').substring(0, 30)}`]);
      }
    } catch (e) { results.push(['CONVERSATIONS (send msg)', false, e.message]); }
  }

  // 9. Products
  try {
    const r = await fetch(`${BASE}/api/products`, { headers: authHeaders });
    results.push(['PRODUCTS (list)', r.status === 200, `Total: ${r.data.total}`]);
  } catch (e) { results.push(['PRODUCTS (list)', false, e.message]); }

  // 10. Categories
  try {
    const r = await fetch(`${BASE}/api/products/categories`, { headers: authHeaders });
    results.push(['CATEGORIES', r.status === 200, `Count: ${r.data.categories?.length}`]);
  } catch (e) { results.push(['CATEGORIES', false, e.message]); }

  // 11. Orders
  try {
    const r = await fetch(`${BASE}/api/orders`, { headers: authHeaders });
    results.push(['ORDERS (list)', r.status === 200, `Total: ${r.data.total}`]);
  } catch (e) { results.push(['ORDERS (list)', false, e.message]); }

  // 12. Update order status
  try {
    const orderId = (await fetch(`${BASE}/api/orders`, { headers: authHeaders })).data.orders?.[0]?.id;
    if (orderId) {
      const r = await fetch(`${BASE}/api/orders`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: { id: orderId, status: 'confirmed' }
      });
      results.push(['ORDERS (update status)', r.status === 200, `New status: ${r.data.order?.status}`]);
    }
  } catch (e) { results.push(['ORDERS (update status)', false, e.message]); }

  // 13. Leads
  try {
    const r = await fetch(`${BASE}/api/leads`, { headers: authHeaders });
    results.push(['LEADS (list)', r.status === 200, `Total: ${r.data.total}`]);
  } catch (e) { results.push(['LEADS (list)', false, e.message]); }

  // 14. Update lead
  try {
    const leadId = (await fetch(`${BASE}/api/leads`, { headers: authHeaders })).data.leads?.[0]?.id;
    if (leadId) {
      const r = await fetch(`${BASE}/api/leads`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: { id: leadId, status: 'contacted' }
      });
      results.push(['LEADS (update)', r.status === 200, `New status: ${r.data.lead?.status}`]);
    }
  } catch (e) { results.push(['LEADS (update)', false, e.message]); }

  // 15. Automations
  try {
    const r = await fetch(`${BASE}/api/automations`, { headers: authHeaders });
    results.push(['AUTOMATIONS (list)', r.status === 200, `Count: ${r.data.automations?.length}`]);
  } catch (e) { results.push(['AUTOMATIONS (list)', false, e.message]); }

  // 16. Create automation
  try {
    const r = await fetch(`${BASE}/api/automations`, {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: { name: 'Test automation', type: 'welcome', messageTemplate: 'Bienvenue!' }
    });
    results.push(['AUTOMATIONS (create)', r.status === 201, `Name: ${r.data.automation?.name}`]);
  } catch (e) { results.push(['AUTOMATIONS (create)', false, e.message]); }

  // 17. AI
  try {
    const r = await fetch(`${BASE}/api/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: { message: 'quel est votre menu?', language: 'fr' }
    });
    results.push(['AI ASSISTANT', r.status === 200, `Category: ${r.data.category}, Reply: ${(r.data.reply || '').substring(0, 40)}`]);
  } catch (e) { results.push(['AI ASSISTANT', false, e.message]); }

  // Print results
  console.log('┌─────────────────────────────┬───────┬──────────────────────────────────┐');
  console.log('│ Module                      │ Status│ Details                          │');
  console.log('├─────────────────────────────┼───────┼──────────────────────────────────┤');
  let pass = 0, fail = 0;
  for (const [name, ok, detail] of results) {
    const icon = ok ? '  OK  ' : ' FAIL ';
    if (ok) pass++; else fail++;
    console.log(`│ ${name.padEnd(27)} │ ${icon} │ ${(detail || '').padEnd(32).substring(0, 32)} │`);
  }
  console.log('└─────────────────────────────┴───────┴──────────────────────────────────┘');
  console.log(`\nResultats: ${pass} OK, ${fail} FAIL sur ${results.length} tests`);
}

main().catch(console.error);