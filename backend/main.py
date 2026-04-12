from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.connection import router as connection_router
from routes.chat import router as chat_router
from routes.migration import router as migration_router
from routes.copilot import router as copilot_router
from routes.context import router as context_router

app = FastAPI(title="DBPilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(connection_router)
app.include_router(chat_router)
app.include_router(migration_router)
app.include_router(copilot_router)
app.include_router(context_router)


@app.get("/health")
def health():
    return {"status": "ok"}
