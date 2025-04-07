class PurchaseOrderResponseFormatter {
  formatPurchaseOrderResponse(purchaseOrder, items = []) {
    const formattedPurchaseOrder = {
      header: {
        purchase_order_details: {
          po_number: purchaseOrder.po_number,
          po_date: purchaseOrder.po_date,
          status: purchaseOrder.status
        },
        partner_details: {
          id: purchaseOrder.partner_id
        },
        file_details: {
          original_filename: purchaseOrder.original_filename,
          file_size: purchaseOrder.file_size,
          file_url: purchaseOrder.file_url
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

  _formatItems(items) {
    if (!items || !Array.isArray(items)) {
      return [];
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
