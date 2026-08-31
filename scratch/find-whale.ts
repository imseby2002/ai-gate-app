import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Searching for the specific conversation with 400 and 200 discounts...");
  const { data: convs, error: err2 } = await supabase
    .from('cs_conversations')
    .select('*');

  if (err2) {
    console.error('Error:', err2);
    return;
  }

  for (const c of convs || []) {
    const history = c.history || [];
    // We look for a history that contains "400" and "200" and "賞鯨" or "二合一"
    const has400 = history.some((h: any) => h.content.includes('400'));
    const has200 = history.some((h: any) => h.content.includes('200'));
    const hasWhale = history.some((h: any) => h.content.includes('鯨') || h.content.includes('合'));

    if (has400 && has200 && hasWhale) {
      console.log(`FOUND MATCH! Customer ID: ${c.customer_id}`);
      console.log(`Updated at: ${c.updated_at}`);
      console.log('--- Full History ---');
      for (const msg of history) {
        console.log(`[${msg.role}]: ${msg.content}`);
      }
      console.log('====================================');
    }
  }
}

main();
