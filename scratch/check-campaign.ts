import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const userId = '9bf9a902-7323-4604-ab50-a3c8e01466a8';
  console.log(`Checking campaign data for user ${userId}...`);

  const { data: campaigns, error: err1 } = await supabase
    .from('marketing_campaigns')
    .select('unit_data, updated_at')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (err1) {
    console.error('Error fetching campaigns:', err1);
    return;
  }

  console.log(`Found ${campaigns?.length} active campaigns.`);
  for (const c of campaigns || []) {
    const unit12 = (c.unit_data as any)?.[12];
    if (unit12) {
      console.log(`Campaign updated at: ${c.updated_at}`);
      console.log('Unit 12 configuration:');
      console.log(JSON.stringify(unit12, null, 2));
      console.log('====================================');
    }
  }

  // Also query cs_data_sources
  const { data: sources, error: err2 } = await supabase
    .from('cs_data_sources')
    .select('*')
    .eq('user_id', userId);

  if (err2) {
    console.error('Error fetching data sources:', err2);
  } else {
    console.log('CS Data Sources:');
    for (const src of sources || []) {
      console.log(`Type: ${src.type} | Name: ${src.name} | Enabled: ${src.enabled}`);
      console.log(JSON.stringify(src.config, null, 2));
      console.log('---');
    }
  }
}

main();
