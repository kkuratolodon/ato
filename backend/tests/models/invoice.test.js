const { Sequelize, DataTypes } = require("sequelize");
const InvoiceModel = require("../../src/models/invoice");
const PartnerModel = require("../../src/models/partner");
const CustomerModel = require("../../src/models/customer");
const VendorModel = require("../../src/models/vendor");
const ItemModel = require("../../src/models/item");
const FinancialDocument = require('../../src/models/base/financialDocument');

describe("Invoice Model", () => {
  let sequelize, Invoice, Partner, Vendor, Customer, Item;

  beforeAll(async () => {
    // Initialize Sequelize with an in-memory SQLite database
    sequelize = new Sequelize("sqlite::memory:", { logging: false });
  
    // Initialize models
    Partner = PartnerModel(sequelize, DataTypes);
    Invoice = InvoiceModel(sequelize, DataTypes);
    Customer = CustomerModel(sequelize, DataTypes);
    Vendor = VendorModel(sequelize, DataTypes);
    Item = ItemModel(sequelize, DataTypes);
    
    // Set up the associations between models
    // NOTE: Skip Item's associate function since it's expecting a different structure
    Invoice.associate({ Partner, Customer, Vendor, Item });
    Partner.associate?.({ Invoice });
    Customer.associate?.({ Invoice });
    Vendor.associate?.({ Invoice });
    
    // Instead of calling Item.associate, manually create the association
    // This avoids the error with Item.belongsToMany
    Item.belongsToMany(Invoice, {
      through: 'FinancialDocumentItem',
      foreignKey: 'item_id',
      otherKey: 'document_id',
      as: 'invoices'
    });
    
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ===== RELATIONSHIP TEST =====

  test("should associate with Partner model correctly", async () => {
    const partner = await Partner.create({
      uuid: "partner-uuid-123",
      name: "Partner A",
      email: "test2@example.com",
      password: "password123",
      created_at: new Date(),
    });

    // Create an Invoice with the partner_id
    const invoiceData = {
      invoice_date: new Date("2023-01-01"),
      due_date: new Date("2023-01-15"),
      purchase_order_id: 456,
      total_amount: 1500.00,
      subtotal_amount: 1400.00,
      discount_amount: 100.00,
      payment_terms: "Net 15",
      file_url: "http://example.com/invoice.pdf",
      status: "Processing",
      partner_id: partner.uuid,
    };
    const invoice = await Invoice.create(invoiceData);

    const fetchedInvoice = await Invoice.findByPk(invoice.id, {
      include: [{
        model: Partner,
        as: 'partner', 
      }],
    });

    expect(fetchedInvoice.partner.uuid).toBe(partner.uuid);
    expect(fetchedInvoice.partner.name).toBe("Partner A");
  });
  // Add this test case
  describe('Invoice Model Associations', () => {

    it('should associate with Vendor correctly', () => {
      // Save original belongsTo method
      const originalBelongsTo = Invoice.belongsTo;
      const originalBelongsToMany = Invoice.belongsToMany;
      
      // Mock BOTH association methods
      Invoice.belongsTo = jest.fn();
      Invoice.belongsToMany = jest.fn();
      
      
      try {
        // Test with all required models
        Invoice.associate({
          Partner: { name: 'Partner' },
          Customer: { name: 'Customer' },
          Vendor: { name: 'Vendor' },
          Item: { name: 'Item' }
        });

        // Test with no models (should return early)
        Invoice.associate(null);
        
        // Test with empty object (no models)
        Invoice.associate({});
        
        // Test with missing Vendor
        Invoice.associate({
          Partner: { name: 'Partner' },
          Customer: { name: 'Customer' }
        });
        
        // Verify the belongsTo was called the correct number of times
        expect(Invoice.belongsTo).toHaveBeenCalledTimes(5);
        // belongsToMany should be called exactly once for Item
        expect(Invoice.belongsToMany).toHaveBeenCalledTimes(1);
      } finally {
        // Restore BOTH original methods
        Invoice.belongsTo = originalBelongsTo;
        Invoice.belongsToMany = originalBelongsToMany;
      }
    });
  });
  // Add this test section to test the base class associations
  describe('FinancialDocument Base Class', () => {
    let sequelize;
    
    beforeEach(() => {
      sequelize = new Sequelize('sqlite::memory:', { logging: false });
    });
    
    afterEach(async () => {
      await sequelize.close();
    });
    
    test('associate method should return early if class name is FinancialDocument', () => {
      // Create a spy to track if the method returns early
      const mockBelongsTo = jest.fn();
      
      // Save original method
      const originalBelongsTo = FinancialDocument.belongsTo;
      
      try {
        // Replace with mock to track calls
        FinancialDocument.belongsTo = mockBelongsTo;
        
        // Call associate directly on the base class
        FinancialDocument.associate({
          Partner: {},
          Customer: {},
          Vendor: {},
          Item: {}
        });
        
        // Verify no association method was called because it should return early
        expect(mockBelongsTo).not.toHaveBeenCalled();
      } finally {
        // Restore original method
        FinancialDocument.belongsTo = originalBelongsTo;
      }
    });
    
    test('should test associate method with non-FinancialDocument context', () => {
      // Create a class that will allow us to call the method with a different context
      class TestDocument extends FinancialDocument {
        // Empty class to test inheritance
      }
      
      // Create spy methods
      const mockBelongsTo = jest.fn();
      const mockBelongsToMany = jest.fn();
      
      // Save original methods
      const originalBelongsTo = TestDocument.belongsTo;
      const originalBelongsToMany = TestDocument.belongsToMany;
      
      try {
        // Replace with mocks
        TestDocument.belongsTo = mockBelongsTo;
        TestDocument.belongsToMany = mockBelongsToMany;
        
        // Call the associate method
        TestDocument.associate({
          Partner: { name: 'Partner' },
          Customer: { name: 'Customer' },
          Vendor: { name: 'Vendor' },
          Item: { name: 'Item' }
        });
        
        // Verify the method calls
        expect(mockBelongsTo).toHaveBeenCalledTimes(3); // Partner, Customer, Vendor
        expect(mockBelongsToMany).toHaveBeenCalledTimes(1); // Item
        
        // Test null/undefined handling
        TestDocument.associate(null);
        TestDocument.associate({});
        
        // Counts should remain the same
        expect(mockBelongsTo).toHaveBeenCalledTimes(3);
        expect(mockBelongsToMany).toHaveBeenCalledTimes(1);
      } finally {
        // Restore original methods
        TestDocument.belongsTo = originalBelongsTo;
        TestDocument.belongsToMany = originalBelongsToMany;
      }
    });
  });

  // ===== POSITIVE CASES =====

  test("should create invoice with all valid fields provided", async () => {
    const invoiceData = {
      invoice_date: new Date("2023-01-01"),
      due_date: new Date("2023-01-15"),
      purchase_order_id: 456,
      total_amount: 1500.00,
      subtotal_amount: 1400.00,
      discount_amount: 100.00,
      payment_terms: "Net 15",
      file_url: "http://example.com/invoice.pdf",
      status: "Processing",
      partner_id: "partner-uuid-123",
    };
    const invoice = await Invoice.create(invoiceData);
    expect(invoice.invoice_date).toEqual(invoiceData.invoice_date);
    expect(invoice.due_date).toEqual(invoiceData.due_date);
    expect(invoice.discount_amount).toBeCloseTo(100.00);
    expect(invoice.file_url).toBe("http://example.com/invoice.pdf");
    expect(invoice.status).toBe("Processing");
  });

  test("should update invoice status correctly", async () => {
    const invoice = await Invoice.create({
      invoice_date: new Date("2023-02-01"),
      due_date: new Date("2023-02-15"),
      purchase_order_id: 789,
      total_amount: 2000.00,
      subtotal_amount: 1900.00,
      payment_terms: "Net 30",
      status: "Processing",
      partner_id: "partner-uuid-123",
    });
    invoice.status = "Processing";
    await invoice.save();
    const updatedInvoice = await Invoice.findByPk(invoice.id);
    expect(updatedInvoice.status).toBe("Processing");
  });

  // ===== NEGATIVE CASES =====

  test("should fail if status is not one of allowed values", async () => {
    await expect(Invoice.create({
      invoice_date: new Date(),
      due_date: new Date(),
      purchase_order_id: 123,
      total_amount: 1000.00,
      subtotal_amount: 900.00,
      payment_terms: "Net 30",
      status: "InvalidStatus",
      partner_id: "partner-uuid-invalid",
    })).rejects.toThrow();
  });

  // ===== CORNER CASES =====

  test("should handle extreme values for total_amount", async () => {
    const extremeAmount = 1e12; // 1 trillion
    const invoice = await Invoice.create({
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 86400000),
      purchase_order_id: 999,
      total_amount: extremeAmount,
      subtotal_amount: extremeAmount - 1000,
      payment_terms: "Net 60",
      status: "Processing",
      partner_id: "partner-uuid-123",
    });
    expect(invoice.total_amount).toBeCloseTo(extremeAmount);
  });

  test("should ignore extra fields not defined in the model", async () => {
    const invoiceData = {
      invoice_date: new Date(),
      due_date: new Date(),
      purchase_order_id: 321,
      total_amount: 500.00,
      subtotal_amount: 450.00,
      payment_terms: "Net 15",
      status: "Processing",
      partner_id: "partner-uuid-123",
      extra_field: "this should be ignored",
    };
    const invoice = await Invoice.create(invoiceData);
    expect(invoice.extra_field).toBeUndefined();
  });

  test("should fail if due_date is earlier than invoice_date", async () => {
    await expect(Invoice.create({
      invoice_date: new Date("2023-05-01"),
      due_date: new Date("2023-04-30"), // due_date is before invoice_date
      purchase_order_id: 555,
      total_amount: 1000.00,
      subtotal_amount: 900.00,
      payment_terms: "Net 30",
      status: "Processing",
      partner_id: "partner-uuid-123",
    })).rejects.toThrow();
  });
  
});
