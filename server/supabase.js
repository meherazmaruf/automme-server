import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rqjkmitbhfddjzcermud.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxamttaXRiaGZkZGp6Y2VybXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0OTk5MjksImV4cCI6MjA5NzA3NTkyOX0.7Mk1pIL8c3Lloz-s3cgluToiPuzWiG26gBDCowEPtDg';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Server-side: use service key (bypasses RLS). Frontend: use anon key (needs RLS policies).
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);

export async function saveGeneratedPost(post) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      title: post.title,
      category: post.category || 'AI & Automation',
      excerpt: post.excerpt || '',
      content: post.content,
      image_url: post.image_url || '',
      image_prompt: post.image_prompt || '',
      status: 'draft',
      section: post.section || 'automme',
      author: 'Maruf AI',
      author_image: '',
      created_at: new Date().toISOString(),
      tags: post.tags || [],
      seo_title: post.seo_title || '',
      seo_description: post.seo_description || '',
      seo_keywords: post.seo_keywords || '',
      slug: post.slug || '',
      readability_score: post.readability_score || 0,
      seo_score: post.seo_score || 0,
    })
    .select();

  if (error) throw error;
  return data[0];
}

export async function saveGenerationLog(log) {
  console.log(`[Log] ${log.agent_name} | ${log.status} | ${log.message}`);
}

export async function getConfig(key) {
  const { data, error } = await supabase
    .from('ai_config')
    .select('value')
    .eq('key', key)
    .single();
  if (error) return null;
  return data?.value;
}

export async function setConfig(key, value) {
  const { data, error } = await supabase
    .from('ai_config')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  return data;
}

// ─── Topic Management ───────────────────────────────────────────

export async function getTopics() {
  const { data, error } = await supabase
    .from('ai_topics')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getTopics error:', error.message);
    return [];
  }
  return data || [];
}

export async function addTopic(topic) {
  const { data, error } = await supabase
    .from('ai_topics')
    .insert({
      topic: topic.trim(),
      status: 'pending',
      created_at: new Date().toISOString()
    })
    .select();
  if (error) {
    console.error('addTopic error:', error.message);
    throw new Error(error.message);
  }
  return data[0];
}

export async function markTopicUsed(id) {
  const { error } = await supabase
    .from('ai_topics')
    .update({ status: 'used', used_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('markTopicUsed error:', error);
}

export async function deleteTopic(id) {
  const { error } = await supabase
    .from('ai_topics')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function getNextPendingTopic() {
  const { data, error } = await supabase
    .from('ai_topics')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) return null;
  return data?.[0] || null;
}
