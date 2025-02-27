const { Sequelize, DataTypes } = require("sequelize");
const InvoiceModel = require("../../src/models/invoice");

describe("Invoice Model", () => {
  let sequelize;
  let Invoice;

  beforeAll(async () => {
    sequelize = new Sequelize("sqlite::memory:", { logging: false });

    // Model diinisialisasi, tapi BELUM ada constraints yang benar
    Invoice = InvoiceModel(sequelize, DataTypes);

    // Sinkronisasi tabel (create table)
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
    });

    expect(invoice.file_url).toBeNull(); // Seharusnya null karena tidak diisi
  });

  test("should ensure total_amount is greater than 0", async () => {
    await expect(
      Invoice.create({
        invoice_date: new Date(),
        due_date: new Date(),
        purchase_order_id: 123,
        total_amount: -100, // Ini harus gagal
        subtotal_amount: 900.50,
        payment_terms: "Net 30",
        status: "Pending",
      })
    ).rejects.toThrow();
  });
});
