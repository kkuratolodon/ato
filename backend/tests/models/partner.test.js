const { Sequelize, DataTypes } = require("sequelize");
const partnerModel = require("../../src/models/partner");

describe("Partner Model", () => {
  let sequelize, Partner;

  beforeAll(async () => {
    // Inisialisasi Sequelize dengan SQLite in-memory
    sequelize = new Sequelize("sqlite::memory:", { logging: false });
    Partner = partnerModel(sequelize, DataTypes);
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("seharusnya berhasil membuat instance Partner dengan data valid", async () => {
    const validData = {
      email: "test@example.com",
      password: "password123",
      name: "Test Partner",
      created_at: new Date(),
    };

    const partner = await Partner.create(validData);
    expect(partner.email).toBe(validData.email);
    // Memastikan nilai default sudah sesuai
    expect(partner.two_factor_authentication).toBe("none");
    expect(partner.status).toBe("pending");
    expect(partner.data_expiry_day).toBe(7);
  });

  test("seharusnya gagal jika email tidak valid", async () => {
    expect.assertions(1);
    const invalidData = {
      email: "invalid-email",
      password: "password123",
      name: "Test Partner",
      created_at: new Date(),
    };

    try {
      await Partner.create(invalidData);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });

  test("seharusnya gagal jika field yang wajib tidak disediakan", async () => {
    expect.assertions(1);
    const missingData = {
      email: null,
      password: null,
      name: null,
      created_at: null,
    };

    try {
      await Partner.create(missingData);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });
});
