jest.mock('../../../src/models', () => ({  
  Invoice: {  
    build: jest.fn().mockImplementation(data => data),  
    findOne: jest.fn(),  
    findAll: jest.fn(),  
    create: jest.fn().mockImplementation(data => Promise.resolve(data)),  
    update: jest.fn().mockImplementation(() => Promise.resolve([1])),  
    destroy: jest.fn().mockImplementation(() => Promise.resolve(1))  
  },  
  sequelize: {  
    transaction: jest.fn().mockImplementation(fn => fn())  
  }  
}));  
