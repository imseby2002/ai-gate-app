import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Dumping recent cs_messages...");
  const { data: messages, error } = await supabase
    .from('cs_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const out = messages?.map((m: any) => ({
    created_at: m.created_at,
    from_id: m.from_id,
    message: m.message,
    reply: m.reply
  }));

  fs.writeFileSync('scratch/recent_messages.json', JSON.stringify(out, null, 2));
  console.log("Done! Written to scratch/recent_messages.json");
}

main();
