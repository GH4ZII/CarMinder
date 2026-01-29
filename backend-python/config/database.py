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
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)