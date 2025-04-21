const { Item } = require('../models');
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

  async createDocumentItem(docType, docId, itemData) {
    console.log("creating document item",docType, docId, itemData);
    return await Item.create({
      uuid: uuidv4(),
      document_type: docType,
      document_id: docId,
      description: itemData.description,
      quantity: itemData.quantity,
      unit: itemData.unit,
      unit_price: itemData.unit_price,
      amount: itemData.amount
    });
  }

  async findItemsByDocumentId(docId, docType) {
    const items = await Item.findAll({
      where: {
        document_type: docType,
        document_id: docId
      }
    });
    return items.map(item => item.get({ plain: true }));
  }
}

module.exports = ItemRepository;