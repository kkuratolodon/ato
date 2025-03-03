const { Sequelize, DataTypes } = require("sequelize");
const InvoiceModel = require("../../src/models/invoice");

describe("Invoice Model - Extended Tests", () => {
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
      status: "Paid",
      partner_id: "partner-uuid-456",
    };
    const invoice = await Invoice.create(invoiceData);
    expect(invoice.invoice_date).toEqual(invoiceData.invoice_date);
    expect(invoice.due_date).toEqual(invoiceData.due_date);
    expect(invoice.discount_amount).toBeCloseTo(100.00);
    expect(invoice.file_url).toBe("http://example.com/invoice.pdf");
    expect(invoice.status).toBe("Paid");
  });

  test("should update invoice status correctly", async () => {
    const invoice = await Invoice.create({
      invoice_date: new Date("2023-02-01"),
      due_date: new Date("2023-02-15"),
      purchase_order_id: 789,
      total_amount: 2000.00,
      subtotal_amount: 1900.00,
      payment_terms: "Net 30",
      status: "Pending",
      partner_id: "partner-uuid-789",
    });
    invoice.status = "Overdue";
    await invoice.save();
    const updatedInvoice = await Invoice.findByPk(invoice.id);
    expect(updatedInvoice.status).toBe("Overdue");
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
      status: "InvalidStatus", // not allowed
      partner_id: "partner-uuid-invalid",
    })).rejects.toThrow();
  });

  test("should fail if purchase_order_id is not a number", async () => {
    await expect(Invoice.create({
      invoice_date: new Date(),
      due_date: new Date(),
      purchase_order_id: "not-a-number", // invalid type
      total_amount: 1000.00,
      subtotal_amount: 900.00,
      payment_terms: "Net 30",
      status: "Pending",
      partner_id: "partner-uuid-123",
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
      status: "Paid",
      partner_id: "partner-uuid-extreme",
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
      status: "Pending",
      partner_id: "partner-uuid-321",
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
      status: "Pending",
      partner_id: "partner-uuid-555",
    })).rejects.toThrow();
  });
});
