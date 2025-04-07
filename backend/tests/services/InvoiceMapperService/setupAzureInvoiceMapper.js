const { AzureInvoiceMapper } = require('../../../src/services/invoiceMapperService/invoiceMapperService');

const mapper = new AzureInvoiceMapper();

// Add generatePartnerId method for partner ID tests
mapper.generatePartnerId = function (vendorName) {
  if (!vendorName) return 'unknown-vendor';

  let partnerId = vendorName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  if (partnerId.length > 44) {
    partnerId = partnerId.substring(0, 44);
  }

  return partnerId;
};

const partnerId = "contoso-partner";

module.exports = {
  getMapper: () => mapper,
  partnerId,
};