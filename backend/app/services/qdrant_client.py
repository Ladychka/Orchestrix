"""Qdrant client wrapper reused by ingestion and orchestrator."""

import os
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from sentence_transformers import SentenceTransformer

COLLECTION_NAME = "finance_officer_knowledge"
MODEL_NAME = "all-MiniLM-L6-v2"


class QdrantService:
    def __init__(self, url: str | None = None):
        self.url = url or os.getenv("QDRANT_URL", "http://localhost:6333")
        self.client = QdrantClient(url=self.url)
        self.model = SentenceTransformer(MODEL_NAME)

    def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        vector = self.model.encode(query).tolist()
        results = self.client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            limit=top_k,
        )
        return [
            {
                "id": r.id,
                "score": r.score,
                "name": r.payload.get("name"),
                "sku": r.payload.get("sku"),
                "unit_price": r.payload.get("unit_price"),
                "stock_quantity": r.payload.get("stock_quantity"),
            }
            for r in results
        ]

    def upsert(self, records: list[dict[str, Any]], start_id: int = 0):
        points = []
        for idx, record in enumerate(records, start=start_id):
            text = f"{record.get('name', '')} — SKU {record.get('sku', '')} — Price ${record.get('unit_price', '')} — Stock {record.get('stock_quantity', '')}"
            vector = self.model.encode(text).tolist()
            points.append(
                PointStruct(
                    id=idx,
                    vector=vector,
                    payload=record,
                )
            )
        self.client.upsert(collection_name=COLLECTION_NAME, points=points)
        return len(points)
