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
            purchaseOrder = await PurchaseOrder.create(purchaseOrderData);
    
            return {
                message: "Purchase Order successfully uploaded",
                purchaseOrderId: purchaseOrder.id
            }
        }catch (error) {
            // this happens after connect to ocr but failed analyse
            // if (purchaseOrder && purchaseOrder.id) {
            //     await PurchaseOrder.update({ status: "Failed" }, { where: { id: purchaseOrder.id } });
            // }
            console.error("Error processing purchase order:", error);
            throw new Error("Failed to process purchase order: " + error.message);
        }
    }
}

module.exports = new PurchaseOrderService();