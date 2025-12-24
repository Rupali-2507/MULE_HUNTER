from fastapi import Header, HTTPException
import os

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

def verify_internal_api_key(x_internal_api_key: str = Header(...)):
    if x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")
