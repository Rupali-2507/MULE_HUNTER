from fastapi import Header, HTTPException
from dotenv import load_dotenv
import os

# Explicit path (safe)
load_dotenv(dotenv_path=".env")

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
print(f"INTERNAL_API_KEY: {INTERNAL_API_KEY}")

if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY is not set in environment")

def verify_internal_api_key(x_internal_api_key: str = Header(...)):
    if x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
