const { Sequelize, DataTypes } = require("sequelize");
const partnerModel = require("../../src/models/partner");

describe("Partner Model", () => {
  let sequelize, Partner;

  beforeAll(async () => {
    sequelize = new Sequelize("sqlite::memory:", { logging: false });
    Partner = partnerModel(sequelize, DataTypes);
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("should successfully create a Partner instance with valid data", async () => {
    const validData = {
      email: "test@example.com",
      password: "password123",
      name: "Test Partner",
      created_at: new Date(),
    };

    const partner = await Partner.create(validData);
    expect(partner.email).toBe(validData.email);
    expect(partner.two_factor_authentication).toBe("none");
    expect(partner.status).toBe("pending");
    expect(partner.data_expiry_day).toBe(7);
  });

  test("should correctly save JSON fields", async () => {
    const menuData = { items: ["home", "profile", "settings"] };
    const authData = { token: "abcdef123456" };
    const configData = { theme: "dark" };

    const data = {
      email: "json@test.com",
      password: "password123",
      name: "Test JSON Partner",
      created_at: new Date(),
      menu: menuData,
      auth: authData,
      config: configData,
    };

    const partner = await Partner.create(data);
    expect(partner.menu).toEqual(menuData);
    expect(partner.auth).toEqual(authData);
    expect(partner.config).toEqual(configData);
  });

  test("should allow optional fields to be null", async () => {
    const data = {
      email: "optional@test.com",
      password: "password123",
      name: "Test Optional Partner",
      created_at: new Date(),
    };

    const partner = await Partner.create(data);
    expect(partner.company_name).toBeNull();
    expect(partner.code).toBeNull();
    expect(partner.role).toBeNull();
    expect(partner.phone_number).toBeNull();
    expect(partner.client_id).toBeNull();
    expect(partner.client_secret).toBeNull();
    expect(partner.secret).toBeNull();
  });

  test("should fail if email is not valid", async () => {
    const invalidData = {
      email: "invalid-email",
      password: "password123",
      name: "Test Partner",
      created_at: new Date(),
    };

    await expect(Partner.create(invalidData)).rejects.toThrow();
  });

  test("should fail if required fields are not provided", async () => {
    const missingData = {
      email: null,
      password: null,
      name: null,
      created_at: null,
    };

    await expect(Partner.create(missingData)).rejects.toThrow();
  });

  test("should fail if two_factor_authentication has an invalid value", async () => {
    const data = {
      email: "test2@example.com",
      password: "password123",
      name: "Test Partner 2",
      created_at: new Date(),
      two_factor_authentication: "invalid-value", // invalid value
    };

    await expect(Partner.create(data)).rejects.toThrow();
  });

  test("should fail if uuid is not unique", async () => {
    const uuid = "unique-uuid-123";
    const partnerData1 = {
      uuid,
      email: "partner1@example.com",
      password: "password123",
      name: "Partner One",
      created_at: new Date(),
    };
    const partnerData2 = {
      uuid,
      email: "partner2@example.com",
      password: "password123",
      name: "Partner Two",
      created_at: new Date(),
    };

    await Partner.create(partnerData1);
    await expect(Partner.create(partnerData2)).rejects.toThrow();
  });

  test("should allow updating partner data", async () => {
    const data = {
      email: "update@test.com",
      password: "oldpassword",
      name: "Update Partner",
      created_at: new Date(),
    };

    const partner = await Partner.create(data);
    partner.password = "newpassword";
    await partner.save();

    const updatedPartner = await Partner.findOne({ where: { email: "update@test.com" } });
    expect(updatedPartner.password).toBe("newpassword");
  });

  test("should ignore extra fields not defined in the model", async () => {
    const data = {
      email: "extra@test.com",
      password: "password123",
      name: "Extra Field Partner",
      created_at: new Date(),
      extra_field: "should be ignored",
    };

    const partner = await Partner.create(data);
    expect(partner.extra_field).toBeUndefined();
  });
});
