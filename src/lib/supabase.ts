import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://akaorqukdoawacvxsdij.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYW9ycXVrZG9hd2FjdnhzZGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDg2MzgsImV4cCI6MjA4NzU4NDYzOH0.60US0KpUqtur_5YqPSX3qxPex1wkzAG7WX-WBmoMi-s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
