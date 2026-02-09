from functools import lru_cache

from supabase import Client, create_client

from config.settings import get_settings


@lru_cache()
def get_supabase() -> Client:
    settings = get_settings()
    url = settings["SUPABASE_URL"]
    key = settings["SUPABASE_SERVICE_KEY"]
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
    return create_client(url, key)
