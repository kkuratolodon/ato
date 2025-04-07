const { Item, FinancialDocumentItem } = require('../models');
const { v4: uuidv4 } = require('uuid');

class ItemRepository {
  async findOrCreateItem(description) {
    const [item] = await Item.findOrCreate({
      where: { description },
      defaults: {
        uuid: uuidv4(),
        description
      }
    });
    
    return item.get({ plain: true });
  }
  
  async createDocumentItem(docType, docId, itemId, itemData) {
    await FinancialDocumentItem.create({
      id: uuidv4(),
      document_type: docType,
      document_id: docId,
      item_id: itemId,
      quantity: itemData.quantity,
      unit: itemData.unit,
      unit_price: itemData.unit_price,
      amount: itemData.amount
    });
  }
  
  async findItemsByDocumentId(docId, docType) {
    const items = [];
    const documentItems = await FinancialDocumentItem.findAll({
      where: {
        document_type: docType,
        document_id: docId
      }
    });
    
    for (const docItem of documentItems) {
      const itemData = docItem.get({ plain: true });
      const itemDetails = await Item.findByPk(itemData.item_id);
      
      if (itemDetails) {
        items.push({
          amount: itemData.amount,
          description: itemDetails.description || null,
          quantity: itemData.quantity,
          unit: itemData.unit,
          unit_price: itemData.unit_price
        });
      }
    }
    
    return items;
  }
}

module.exports = ItemRepository;