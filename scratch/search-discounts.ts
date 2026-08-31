import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Searching for discount discussions in cs_messages...");
  
  const { data: messages, error } = await supabase
    .from('cs_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter messages related to the discount issue
  const matchingMessages = messages.filter(m => 
    m.message?.includes('折') || 
    m.reply?.includes('折') || 
    m.message?.includes('400') || 
    m.reply?.includes('400') ||
    m.message?.includes('200') ||
    m.reply?.includes('200') ||
    m.message?.includes('老') ||
    m.reply?.includes('老') ||
    m.message?.includes('鯨') ||
    m.reply?.includes('鯨')
  );

  console.log(`Found ${matchingMessages.length} matching messages.`);
  
  // Group by customer (from_id)
  const customerIds = Array.from(new Set(matchingMessages.map(m => m.from_id)));
  console.log("Matching customers:", customerIds);

  for (const cid of customerIds) {
    console.log(`\n=================== CUSTOMER: ${cid} ===================`);
    // Load full history for this customer from cs_conversations
    const { data: conv } = await supabase
      .from('cs_conversations')
      .select('*')
      .eq('customer_id', cid)
      .maybeSingle();

    if (conv) {
      console.log(`User ID: ${conv.user_id}`);
      console.log("History:");
      console.log(JSON.stringify(conv.history, null, 2));
    } else {
      console.log("No full conversation history found in cs_conversations.");
      // Fallback to cs_messages for this customer
      const { data: cMsgs } = await supabase
        .from('cs_messages')
        .select('*')
        .eq('from_id', cid)
        .order('created_at', { ascending: true });
      
      for (const m of cMsgs || []) {
        console.log(`[${m.created_at}] User: ${m.message}`);
        console.log(`[${m.created_at}] AI: ${m.reply}`);
        console.log('---');
      }
    }
  }
}

main();
