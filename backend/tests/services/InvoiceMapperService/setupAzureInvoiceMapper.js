const { AzureInvoiceMapper } = require('../../../src/services/invoiceMapperService');

/**  
 * @typedef {Object} MapperConfig  
 * @property {string} partnerId  
 * @property {Object} options  
 */  

/**  
 * Creates a configured mapper instance for testing  
 * @param {Partial<MapperConfig>} config  
 * @returns {AzureInvoiceMapper}  
 */  
const createTestMapper = (config = {}) => {  
  const mapper = new AzureInvoiceMapper();  
  mapper.generatePartnerId = function (vendorName) {  
    if (!vendorName) return 'unknown-vendor';  
    let partnerId = vendorName  
      .toLowerCase()  
      .trim()  
      .replace(/\s+/g, '-')  
      .replace(/[^a-z0-9-]/g, '');  
    return partnerId.substring(0, 44);  
  };  
  return mapper;  
};  

const defaultPartnerId = 'contoso-partner';  

module.exports = {  
  getMapper: () => createTestMapper(),  
  partnerId: defaultPartnerId,  
  createTestMapper  
};  