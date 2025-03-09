const FinancialDocumentService = require('./financialDocumentService')
const {PurchaseOrder} = require("../models")

class PurchaseOrderService extends FinancialDocumentService{
    constructor(){
        super("Purchase Order");
    }
    async uploadPurchaseOrder(fileData){
        let purchaseOrder;
        try{
            const { buffer, originalname, partnerId } = fileData;
    
            const purchaseOrderData = await this.uploadFile(fileData);
            const purchaseOrder = await PurchaseOrder.create(purchaseOrderData);
    
            return {
                message: "Purchase Order successfully uploaded",
                purchaseOrderId: purchaseOrder.id
            }
        }catch (error) {
            if (purchaseOrder && purchaseOrder.id) {
                await Invoice.update({ status: "Failed" }, { where: { id: invoice.id } });
            }
            console.error("Error processing purchase order:", error);
            throw new Error("Failed to process purchase order: " + error.message);
        }
    }
}

module.exports = new PurchaseOrderService();