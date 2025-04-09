class PurchaseOrderResponseFormatter {
  formatPurchaseOrderResponse(purchaseOrder, items = [], customer = null, vendor = null) {
    const formattedPurchaseOrder = {
      header: {
        invoice_details: {
          invoice_id: null,
          purchase_order_id: purchaseOrder.po_number,
          invoice_date: null,
          due_date: purchaseOrder.due_date,
          payment_terms: purchaseOrder.payment_terms
        },
        vendor_details: this._formatVendorDetails(vendor),
        customer_details: this._formatCustomerDetails(customer),
        financial_details: {
          currency: purchaseOrder.currency_code,
          total_amount: purchaseOrder.total_amount,
          subtotal_amount: purchaseOrder.subtotal_amount,
          discount_amount: purchaseOrder.discount_amount,
          total_tax_amount: purchaseOrder.tax_amount
        }
      },
      items: this._formatItems(items)
    };

    return {
      data: {
        documents: [formattedPurchaseOrder]
      }
    };
  }

  _formatVendorDetails(vendor) {
    if (!vendor) {
      return {
        name: null,
        address: null,
        recipient_name: null,
        tax_id: null
      };
    }

    return {
      name: vendor.name,
      address: vendor.address || null,
      recipient_name: vendor.recipient_name,
      tax_id: vendor.tax_id
    };
  }

  _formatCustomerDetails(customer) {
    if (!customer) {
      return {
        id: null,
        name: null,
        recipient_name: null,
        address: null,
        tax_id: null
      };
    }

    return {
      id: customer.uuid,
      name: customer.name,
      recipient_name: customer.recipient_name,
      address: customer.address || null,
      tax_id: customer.tax_id
    };
  }

  _formatItems(items) {
    if (!items || !Array.isArray(items)) {
      return [
        {
          amount: null,
          description: null,
          quantity: null,
          unit: null,
          unit_price: null
        }
      ];
    }

    if (items.length === 0) {
      return [
        {
          amount: null,
          description: null,
          quantity: null,
          unit: null,
          unit_price: null
        }
      ];
    }

    return items.map(item => ({
      amount: item.amount,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price
    }));
  }
}

module.exports = PurchaseOrderResponseFormatter;
