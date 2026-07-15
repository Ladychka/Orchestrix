"""Tool: draft_quotation_email — generate a quotation email body."""

from datetime import datetime


def draft_quotation_email(customer_email: str, quote: dict) -> str:
    """Draft a professional quotation email.

    Args:
        customer_email: Recipient address (used for greeting).
        quote: Output from calculate_quote — line_items and total_price.

    Returns:
        The email body as a string.
    """
    lines = [
        f"Dear Customer ({customer_email}),",
        "",
        "Thank you for your interest. Please find your quotation below:",
        "",
        "-" * 40,
    ]

    for item in quote.get("line_items", []):
        note = item.get("note", "")
        if note:
            lines.append(f"• {item['sku']}: {note}")
        else:
            line = (
                f"• {item['name']} ({item['sku']}) — "
                f"Qty: {item['quantity']} @ ${item['unit_price']:.2f}"
            )
            if item.get("discount", 0) > 0:
                line += f" — Discount: -${item['discount']:.2f}"
            line += f" = ${item['subtotal']:.2f}"
            lines.append(line)

    lines.extend([
        "-" * 40,
        f"Total: ${quote.get('total_price', 0):.2f} {quote.get('currency', 'USD')}",
        "",
        "This quote is valid for 14 days.",
        "",
        "Best regards,",
        "AI Finance Officer",
        f"{datetime.utcnow().strftime('%Y-%m-%d')}",
    ])

    return "\n".join(lines)
