import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Searching for messages from: ${today}`);

  // Query cs_messages
  const { data: messages, error: err1 } = await supabase
    .from('cs_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (err1) {
    console.error('Error querying cs_messages:', err1);
  } else {
    console.log(`Found ${messages?.length} messages in cs_messages.`);
    for (const msg of messages || []) {
      if (
        msg.message.includes('賞鯨') ||
        msg.reply.includes('折') ||
        msg.message.includes('折') ||
        msg.message.includes('400') ||
        msg.reply.includes('400')
      ) {
        console.log(`[${msg.created_at}] User ${msg.user_id} | Cust ${msg.from_id}`);
        console.log(`Msg: ${msg.message}`);
        console.log(`Reply: ${msg.reply}`);
        console.log('---');
      }
    }
  }

  // Let's also look at cs_conversations to get full history of recent chats
  const { data: convs, error: err2 } = await supabase
    .from('cs_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (err2) {
    console.error('Error querying cs_conversations:', err2);
  } else {
    console.log(`\nRecent cs_conversations:`);
    for (const conv of convs || []) {
      console.log(`User: ${conv.user_id} | Cust: ${conv.customer_id} | Updated: ${conv.updated_at}`);
      const history = conv.history || [];
      const hasWhale = history.some((h: any) => h.content.includes('賞鯨') || h.content.includes('折'));
      if (hasWhale) {
        console.log('History Match:');
        console.log(JSON.stringify(history, null, 2));
        console.log('===');
      }
    }
  }
}

main();
