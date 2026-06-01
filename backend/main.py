from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import documents, schemas, settings

app = FastAPI(
    title="Document Intelligence API",
    version="0.1.0",
    description="Extract structured data from any PDF document"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(schemas.router, prefix="/api/schemas", tags=["schemas"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}