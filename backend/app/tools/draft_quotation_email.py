"""Tool: draft_quotation_email — generate a professional quotation email body in both HTML and plain text."""

from datetime import datetime, timedelta


def draft_quotation_email(customer_email: str, quote: dict) -> dict:
    """Draft a professional quotation email.

    Args:
        customer_email: Recipient address (used for greeting).
        quote: Output from calculate_quote — line_items and total_price.

    Returns:
        Dict with 'html' and 'text' keys for MIME multipart emails.
    """
    lines = []
    html_lines = []

    valid_until = (datetime.utcnow() + timedelta(days=14)).strftime('%B %d, %Y')
    today = datetime.utcnow().strftime('%B %d, %Y')

    # Plain text version
    lines.append(f"Dear Customer,")
    lines.append("")
    lines.append("Thank you for your interest in our products. Please find your quotation below:")
    lines.append("")

    # HTML version header
    html_lines.append(
        "<!DOCTYPE html>\n"
        "<html>\n"
        "<head>\n"
        "  <style>\n"
        "    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }\n"
        "    .header { background: linear-gradient(135deg, #4F46E5 0%, #3730A3 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }\n"
        "    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }\n"
        "    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }\n"
        "    .content { background: #ffffff; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; }\n"
        "    .greeting { font-size: 15px; margin-bottom: 20px; }\n"
        "    .section-title { font-size: 13px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin: 24px 0 12px; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; }\n"
        "    table { width: 100%; border-collapse: collapse; font-size: 14px; }\n"
        "    th { text-align: left; padding: 10px 8px; background: #F8FAFC; color: #475569; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #E2E8F0; }\n"
        "    td { padding: 10px 8px; border-bottom: 1px solid #F1F5F9; color: #334155; }\n"
        "    .num { text-align: right; font-family: 'SF Mono', Monaco, monospace; }\n"
        "    .discount { color: #16A34A; }\n"
        "    .total-row { font-weight: 700; font-size: 16px; background: #F8FAFC; }\n"
        "    .total-row td { border-top: 2px solid #E2E8F0; border-bottom: none; padding-top: 14px; }\n"
        "    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #E2E8F0; font-size: 13px; color: #64748B; }\n"
        "    .validity { background: #FEF3C7; color: #92400E; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 16px 0; }\n"
        "    .signature { margin-top: 24px; }\n"
        "    .signature strong { color: #1E293B; }\n"
        "  </style>\n"
        "</head>\n"
        "<body>\n"
        f'  <div class="header">\n'
        f'    <h1>Quotation from AI Finance Officer</h1>\n'
        f'    <p>Ref: {today} — {customer_email}</p>\n'
        f'  </div>\n'
        f'  <div class="content">\n'
        f'    <p class="greeting">Dear Customer,</p>\n'
        f'    <p>Thank you for your interest in our products. Please find your detailed quotation below:</p>\n'
        f'    <div class="section-title">Quotation Details</div>\n'
        f'    <table>\n'
        f'      <thead>\n'
        f'        <tr>\n'
        f'          <th>Product</th>\n'
        f'          <th>SKU</th>\n'
        f'          <th class="num">Qty</th>\n'
        f'          <th class="num">Unit Price</th>\n'
        f'          <th class="num">Discount</th>\n'
        f'          <th class="num">Subtotal</th>\n'
        f'        </tr>\n'
        f'      </thead>\n'
        f'      <tbody>\n'
    )

    for item in quote.get("line_items", []):
        note = item.get("note", "")
        if note:
            lines.append(f"  • {item['sku']}: {note}")
            html_lines.append(f"        <tr><td colspan='6' style='color:#DC2626'>[WARNING] {item['sku']}: {note}</td></tr>\n")
        else:
            name = item.get('name', '')
            sku = item.get('sku', '')
            qty = item.get('quantity', 0)
            price = item.get('unit_price', 0)
            discount = item.get('discount', 0)
            subtotal = item.get('subtotal', 0)

            lines.append(
                f"  • {name} ({sku}) — Qty: {qty} @ ${price:.2f}"
                + (f" — Discount: -${discount:.2f}" if discount > 0 else "")
                + f" = ${subtotal:.2f}"
            )

            discount_html = f"<span class='discount'>-${discount:.2f}</span>" if discount > 0 else "—"
            html_lines.append(
                f"        <tr>"
                f"<td>{name}</td>"
                f"<td>{sku}</td>"
                f"<td class='num'>{qty}</td>"
                f"<td class='num'>${price:.2f}</td>"
                f"<td class='num'>{discount_html}</td>"
                f"<td class='num'>${subtotal:.2f}</td>"
                f"</tr>\n"
            )

    total = quote.get("total_price", 0)
    currency = quote.get("currency", "USD")

    lines.append("")
    lines.append(f"  TOTAL: ${total:.2f} {currency}")
    lines.append("")
    lines.append(f"This quote is valid until {valid_until}.")
    lines.append("")
    lines.append("If you have any questions, please don't hesitate to reach out.")
    lines.append("")
    lines.append("Best regards,")
    lines.append("AI Finance Officer")
    lines.append(f"{today}")

    html_lines.append(
        f"      </tbody>\n"
        f"      <tbody>\n"
        f'        <tr class="total-row">\n'
        f'          <td colspan="5">Total Amount</td>\n'
        f'          <td class="num">${total:.2f} {currency}</td>\n'
        f"        </tr>\n"
        f"      </tbody>\n"
        f"    </table>\n\n"
        f'    <div class="validity">\n'
        f"      ⏳ This quotation is valid until <strong>{valid_until}</strong>.\n"
        f"    </div>\n\n"
        f'    <div class="footer">\n'
        f"      If you have any questions, please don't hesitate to reach out.\n"
        f"    </div>\n\n"
        f'    <div class="signature">\n'
        f"      <p>Best regards,</p>\n"
        f"      <p><strong>AI Finance Officer</strong></p>\n"
        f'      <p style="color:#94A3B8;font-size:12px">{today}</p>\n'
        f"    </div>\n"
        f"  </div>\n"
        f"</body>\n"
        f"</html>\n"
    )

    return {
        "text": "\n".join(lines),
        "html": "\n".join(html_lines),
    }
