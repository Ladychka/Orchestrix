"""Tool: calculate_quote — compute line items and total with bulk discounts."""

from app.services.qdrant_client import QdrantService


def calculate_quote(items: list[dict]) -> dict:
    """Calculate a quotation given SKU/quantity pairs.

    Args:
        items: List of dicts like [{"sku": "SKU-101", "quantity": 200}].

    Returns:
        Dict with line_items and total_price. Applies a 5%% bulk discount
        on any line where quantity > 100.
    """
    svc = QdrantService()
    line_items = []
    total = 0.0

    for item in items:
        sku = item.get("sku")
        quantity = item.get("quantity", 0)

        # Lookup exact SKU via Qdrant
        hits = svc.search(query=sku, top_k=1)
        if not hits:
            line_items.append({
                "sku": sku,
                "quantity": quantity,
                "unit_price": 0.0,
                "subtotal": 0.0,
                "note": "Product not found",
            })
            continue

        product = hits[0]
        unit_price = float(product.get("unit_price", 0))
        subtotal = unit_price * quantity

        # Bulk discount: >100 units gets 5%% off that line
        discount = 0.0
        if quantity > 100:
            discount = subtotal * 0.05
            subtotal -= discount

        line_items.append({
            "sku": sku,
            "name": product.get("name", ""),
            "quantity": quantity,
            "unit_price": unit_price,
            "discount": round(discount, 2),
            "subtotal": round(subtotal, 2),
        })
        total += subtotal

    return {
        "line_items": line_items,
        "total_price": round(total, 2),
        "currency": "USD",
    }
