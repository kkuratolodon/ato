const CustomerRepository = require('@repositories/customerRepository');
const { Customer } = require('@models/');

// Mock the Customer model
jest.mock('@models/', () => ({
    Customer: {
        findByPk: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn()
    }
}));

describe('CustomerRepository', () => {
    let customerRepository;
    let mockCustomerData;
    
    beforeEach(() => {
        customerRepository = new CustomerRepository();
        mockCustomerData = {
            id: 1,
            name: 'Test Customer',
            email: 'test@example.com',
            phone: '123456789'
        };
        
        // Reset all mocks
        jest.clearAllMocks();
    });
    
    describe('findById', () => {
        // Positive case
        it('should return customer data when found by id', async () => {
            const mockGetPlain = jest.fn().mockReturnValue(mockCustomerData);
            Customer.findByPk.mockResolvedValue({ get: mockGetPlain });
            
            const result = await customerRepository.findById(1);
            
            expect(Customer.findByPk).toHaveBeenCalledWith(1);
            expect(mockGetPlain).toHaveBeenCalledWith({ plain: true });
            expect(result).toEqual(mockCustomerData);
        });
        
        // Negative case
        it('should return null when customer with id is not found', async () => {
            Customer.findByPk.mockResolvedValue(null);
            
            const result = await customerRepository.findById(999);
            
            expect(Customer.findByPk).toHaveBeenCalledWith(999);
            expect(result).toBeNull();
        });
        
        // Edge case
        it('should handle error when findById throws exception', async () => {
            Customer.findByPk.mockRejectedValue(new Error('Database error'));
            
            await expect(customerRepository.findById(1)).rejects.toThrow('Database error');
        });
    });
    
    describe('findByAttributes', () => {
        // Positive case
        it('should return customer data when found by attributes', async () => {
            const mockGetPlain = jest.fn().mockReturnValue(mockCustomerData);
            const attributes = { email: 'test@example.com' };
            Customer.findOne.mockResolvedValue({ get: mockGetPlain });
            
            const result = await customerRepository.findByAttributes(attributes);
            
            expect(Customer.findOne).toHaveBeenCalledWith({ where: attributes });
            expect(mockGetPlain).toHaveBeenCalledWith({ plain: true });
            expect(result).toEqual(mockCustomerData);
        });
        
        // Negative case
        it('should return null when customer with attributes is not found', async () => {
            const attributes = { email: 'nonexistent@example.com' };
            Customer.findOne.mockResolvedValue(null);
            
            const result = await customerRepository.findByAttributes(attributes);
            
            expect(Customer.findOne).toHaveBeenCalledWith({ where: attributes });
            expect(result).toBeNull();
        });
        
        // Edge case
        it('should handle error when findByAttributes throws exception', async () => {
            const attributes = { email: 'test@example.com' };
            Customer.findOne.mockRejectedValue(new Error('Database error'));
            
            await expect(customerRepository.findByAttributes(attributes)).rejects.toThrow('Database error');
        });
        
        // Edge case - empty attributes object
        it('should handle empty attributes object', async () => {
            const attributes = {};
            const mockGetPlain = jest.fn().mockReturnValue([]);
            Customer.findOne.mockResolvedValue({ get: mockGetPlain });
            
            const result = await customerRepository.findByAttributes(attributes);
            
            expect(Customer.findOne).toHaveBeenCalledWith({ where: attributes });
            expect(result).toEqual([]);
        });
    });
    
    describe('create', () => {
        // Positive case
        it('should create and return customer data', async () => {
            const mockGetPlain = jest.fn().mockReturnValue(mockCustomerData);
            Customer.create.mockResolvedValue({ get: mockGetPlain });
            
            const result = await customerRepository.create(mockCustomerData);
            
            expect(Customer.create).toHaveBeenCalledWith(mockCustomerData);
            expect(mockGetPlain).toHaveBeenCalledWith({ plain: true });
            expect(result).toEqual(mockCustomerData);
        });
        
        // Negative case
        it('should throw error when customer creation fails due to validation', async () => {
            const invalidData = { name: '' };
            Customer.create.mockRejectedValue(new Error('Validation error'));
            
            await expect(customerRepository.create(invalidData)).rejects.toThrow('Validation error');
            expect(Customer.create).toHaveBeenCalledWith(invalidData);
        });
        
        // Edge case
        it('should handle creating customer with minimum required fields', async () => {
            const minimalData = { name: 'Minimal Customer' };
            const minimalResult = { id: 2, name: 'Minimal Customer' };
            const mockGetPlain = jest.fn().mockReturnValue(minimalResult);
            Customer.create.mockResolvedValue({ get: mockGetPlain });
            
            const result = await customerRepository.create(minimalData);
            
            expect(Customer.create).toHaveBeenCalledWith(minimalData);
            expect(result).toEqual(minimalResult);
        });
    });
});