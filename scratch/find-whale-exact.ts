import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: convs, error } = await supabase
    .from('cs_conversations')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const results: any[] = [];
  for (const c of convs || []) {
    const history = c.history || [];
    const has400 = history.some((h: any) => h.content.includes('400'));
    const has200 = history.some((h: any) => h.content.includes('200'));
    
    if (has400 && has200) {
      results.push({
        customer_id: c.customer_id,
        updated_at: c.updated_at,
        history: history
      });
    }
  }

  fs.writeFileSync('scratch/match.json', JSON.stringify(results, null, 2));
  console.log(`Done! Found ${results.length} matches.`);
}

main();
