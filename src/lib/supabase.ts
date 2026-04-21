//import { createClient } from "@supabase/supabase-js";
//const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL2!;
//const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
//export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL2;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseAdmin = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );