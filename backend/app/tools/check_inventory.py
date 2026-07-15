"""Tool: check_inventory — search Qdrant for matching products with stock and price."""

from app.services.qdrant_client import QdrantService


def check_inventory(product_query: str) -> list[dict]:
    """Search the knowledge base for products matching the query.

    Args:
        product_query: Free-text query (e.g., "laptop", "SKU-101").

    Returns:
        List of product dicts with keys: name, sku, unit_price, stock_quantity.
    """
    svc = QdrantService()
    results = svc.search(query=product_query, top_k=5)
    return results
