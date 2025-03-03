const { Sequelize, DataTypes } = require("sequelize");
const InvoiceModel = require("../../src/models/invoice");

describe("Invoice Model", () => {
  let sequelize;
  let Invoice;

  beforeAll(async () => {
    sequelize = new Sequelize("sqlite::memory:", { logging: false });

    Invoice = InvoiceModel(sequelize, DataTypes);

    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("should define Invoice model", () => {
    expect(Invoice).toBeDefined();
  });

  test("should not allow null values for required fields", async () => {
    await expect(Invoice.create({})).rejects.toThrow();
  });

  test("should allow optional fields to be null", async () => {
    const invoice = await Invoice.create({
      invoice_date: new Date(),
      due_date: new Date(),
      purchase_order_id: 123,
      total_amount: 1000.50,
      subtotal_amount: 900.50,
      payment_terms: "Net 30",
      status: "Pending",
      partner_id: "partner-uuid-123"
    });

    expect(invoice.file_url).toBeNull();
  });

  test("should ensure total_amount is greater than 0", async () => {
    await expect(
      Invoice.create({
        invoice_date: new Date(),
        due_date: new Date(),
        purchase_order_id: 123,
        total_amount: -100,
        subtotal_amount: 900.50,
        payment_terms: "Net 30",
        status: "Pending",
      })
    ).rejects.toThrow();
  });
});

describe("Invoice Model - Partner Association", () => {
  let sequelize, Invoice;

  beforeAll(async () => {
    // Initialize Sequelize with an in-memory SQLite database
    sequelize = new Sequelize("sqlite::memory:", { logging: false });
    Invoice = InvoiceModel(sequelize, DataTypes);
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("should store partner_id in Invoice", async () => {
    const invoiceData = {
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 86400000), // due date is tomorrow
      purchase_order_id: 123,
      total_amount: 1000.00,
      subtotal_amount: 900.00,
      payment_terms: "Net 30",
      status: "Pending",
      partner_id: "partner-uuid-123",
    };

    const invoice = await Invoice.create(invoiceData);
    expect(invoice.partner_id).toBe("partner-uuid-123");
  });
});