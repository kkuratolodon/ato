jest.mock('../../../src/models', () => ({
  Invoice: {
    build: jest.fn().mockImplementation(data => data)
  },
  sequelize: {}
}));
