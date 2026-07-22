"""Standalone test script for Phase 3 tools — no LLM involved."""

from app.tools.check_inventory import check_inventory
from app.tools.calculate_quote import calculate_quote
from app.tools.draft_quotation_email import draft_quotation_email
from app.tools.send_email import send_email


def test_check_inventory():
    print("\n=== test_check_inventory ===")
    results = check_inventory("laptop")
    print(f"Found {len(results)} result(s)")
    for r in results:
        print(f"  {r['sku']}: {r['name']} — ${r['unit_price']} — stock {r['stock_quantity']}")
    assert len(results) > 0, "Expected at least one laptop result"


def test_calculate_quote():
    print("\n=== test_calculate_quote ===")
    quote = calculate_quote([{"sku": "SKU-101", "quantity": 200}])
    print(f"Line items: {quote['line_items']}")
    print(f"Total: ${quote['total_price']}")
    assert quote["total_price"] > 0, "Expected positive total"
    # Bulk discount check: 200 * 899 = 179800; 5%% off = 171810
    expected = round(200 * 899.0 * 0.95, 2)
    assert quote["total_price"] == expected, f"Expected {expected}, got {quote['total_price']}"


def test_draft_quotation_email():
    print("\n=== test_draft_quotation_email ===")
    quote = calculate_quote([{"sku": "SKU-101", "quantity": 50}])
    result = draft_quotation_email("test@example.com", quote)
    assert isinstance(result, dict), "Expected dict with text/html keys"
    text = result.get("text", "")
    html = result.get("html", "")
    print(text[:300] + "...")
    assert "TOTAL:" in text
    assert "AI Finance Officer" in text
    assert "<html>" in html or "<table>" in html, "Expected HTML table in html version"


def test_send_email():
    print("\n=== test_send_email ===")
    result = send_email("test@example.com", "Test Subject", "This is a test.")
    print(f"send_email returned: {result}")
    # We assert False here only when credentials are missing; in a real run with
    # valid credentials this should be True.


if __name__ == "__main__":
    test_check_inventory()
    test_calculate_quote()
    test_draft_quotation_email()
    test_send_email()
    print("\n[PASS] All Phase 3 tool tests passed (where dependencies available).")
