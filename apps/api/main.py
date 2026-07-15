from fastapi import FastAPI

app = FastAPI(title="Career Agent API")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
