import os
from dotenv import load_dotenv
from supabase import create_client, Client
from functools import lru_cache

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  

@lru_cache()
def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"❌ Missing Supabase credentials")
        print(f"   SUPABASE_URL present: {bool(SUPABASE_URL)}")
        print(f"   SUPABASE_KEY present: {bool(SUPABASE_KEY)}")
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    
    print(f"✅ Creating Supabase client with URL: {SUPABASE_URL[:30]}...")
    return create_client(SUPABASE_URL, SUPABASE_KEY)