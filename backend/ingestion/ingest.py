"""Ingest product catalog into Qdrant for the AI Finance Officer knowledge base."""

import json
import os

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "finance_officer_knowledge"
MODEL_NAME = "all-MiniLM-L6-v2"


def load_products(path: str = "products.json") -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_or_create_collection(client: QdrantClient, dim: int = 384):
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )
        print(f"Created collection '{COLLECTION_NAME}'.")
    else:
        print(f"Collection '{COLLECTION_NAME}' already exists.")


def upsert_products(client: QdrantClient, model: SentenceTransformer, products: list[dict]):
    points = []
    for idx, product in enumerate(products):
        text = f"{product['name']} — SKU {product['sku']} — Price ${product['unit_price']} — Stock {product['stock_quantity']}"
        vector = model.encode(text).tolist()
        points.append(
            PointStruct(
                id=idx,
                vector=vector,
                payload={
                    "name": product["name"],
                    "sku": product["sku"],
                    "unit_price": product["unit_price"],
                    "stock_quantity": product["stock_quantity"],
                },
            )
        )
    client.upsert(collection_name=COLLECTION_NAME, points=points)
    print(f"Upserted {len(points)} products into '{COLLECTION_NAME}'.")


def main():
    client = QdrantClient(url=QDRANT_URL)
    model = SentenceTransformer(MODEL_NAME)

    get_or_create_collection(client, dim=model.get_sentence_embedding_dimension())
    products = load_products()
    upsert_products(client, model, products)

    # Quick sanity search
    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=model.encode("laptop").tolist(),
        limit=3,
    )
    print("\nSanity search for 'laptop':")
    for r in results:
        print(f"  - {r.payload['name']} (score={r.score:.3f})")


if __name__ == "__main__":
    main()
