import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from errors import register_exception_handlers
from routers.health import router as health_router
from routers.knowledge import router as knowledge_router
from routers.search import router as search_router

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

register_exception_handlers(app)

app.include_router(health_router)
app.include_router(knowledge_router, prefix="/api/v1/knowledge")
app.include_router(search_router, prefix="/api/v1/search")
