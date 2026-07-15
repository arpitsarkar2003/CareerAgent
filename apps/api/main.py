import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.health import router as health_router

app = FastAPI(title="Career Agent API")

_web_origins = [
    o.strip()
    for o in os.environ.get("WEB_ORIGIN", "http://localhost:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_web_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
