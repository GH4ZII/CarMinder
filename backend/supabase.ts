import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;



console.log('  URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
console.log('  Key:', supabaseAnonKey ? '✓ Set' : '✗ Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(' Missing Supabase environment variables!');
  console.error('Make sure .env file exists and restart Expo with: npx expo start --clear');
}

// Create client only if both values exist
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;