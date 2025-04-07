const VendorRepository = require('../../src/repositories/vendorRepository');
const { Vendor } = require('../../src/models');

// Mock the Sequelize model
jest.mock('../../src/models', () => ({
    Vendor: {
        findByPk: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn()
    }
}));

describe('VendorRepository', () => {
    let repository;
    const mockVendor = {
        id: 1,
        name: 'Test Vendor',
        email: 'vendor@test.com',
        phone: '123456789',
        address: 'Test Address',
        get: jest.fn(() => mockVendor)
    };

    beforeEach(() => {
        repository = new VendorRepository();
        jest.clearAllMocks();
        mockVendor.get.mockReturnValue(mockVendor);
    });

    describe('findById', () => {
        // Positive case
        it('should return vendor data when vendor exists', async () => {
            Vendor.findByPk.mockResolvedValue(mockVendor);
            
            const result = await repository.findById(1);
            
            expect(Vendor.findByPk).toHaveBeenCalledWith(1);
            expect(mockVendor.get).toHaveBeenCalledWith({ plain: true });
            expect(result).toEqual(mockVendor);
        });
        
        // Negative case
        it('should return null when vendor does not exist', async () => {
            Vendor.findByPk.mockResolvedValue(null);
            
            const result = await repository.findById(999);
            
            expect(Vendor.findByPk).toHaveBeenCalledWith(999);
            expect(result).toBeNull();
        });
        
        // Edge case
        it('should handle error when database query fails', async () => {
            Vendor.findByPk.mockRejectedValue(new Error('Database error'));
            
            await expect(repository.findById(1)).rejects.toThrow('Database error');
        });
    });

    describe('findByAttributes', () => {
        // Positive case
        it('should return vendor data when vendor with attributes exists', async () => {
            const attributes = { email: 'vendor@test.com' };
            Vendor.findOne.mockResolvedValue(mockVendor);
            
            const result = await repository.findByAttributes(attributes);
            
            expect(Vendor.findOne).toHaveBeenCalledWith({ where: attributes });
            expect(mockVendor.get).toHaveBeenCalledWith({ plain: true });
            expect(result).toEqual(mockVendor);
        });
        
        // Negative case
        it('should return null when vendor with attributes does not exist', async () => {
            const attributes = { email: 'nonexistent@test.com' };
            Vendor.findOne.mockResolvedValue(null);
            
            const result = await repository.findByAttributes(attributes);
            
            expect(Vendor.findOne).toHaveBeenCalledWith({ where: attributes });
            expect(result).toBeNull();
        });
        
        // Edge case
        it('should handle multiple attributes in query', async () => {
            const attributes = { name: 'Test Vendor', email: 'vendor@test.com' };
            Vendor.findOne.mockResolvedValue(mockVendor);
            
            const result = await repository.findByAttributes(attributes);
            
            expect(Vendor.findOne).toHaveBeenCalledWith({ where: attributes });
            expect(result).toEqual(mockVendor);
        });
    });

    describe('create', () => {
        // Positive case
        it('should create and return new vendor data', async () => {
            const vendorData = {
                name: 'New Vendor',
                email: 'new@vendor.com',
                phone: '987654321',
                address: 'New Address'
            };
            const newVendor = { ...vendorData, id: 2, get: jest.fn(() => ({ ...vendorData, id: 2 })) };
            Vendor.create.mockResolvedValue(newVendor);
            
            const result = await repository.create(vendorData);
            
            expect(Vendor.create).toHaveBeenCalledWith(vendorData);
            expect(newVendor.get).toHaveBeenCalledWith({ plain: true });
            expect(result).toEqual({ ...vendorData, id: 2 });
        });
        
        // Negative case
        it('should throw error when creating vendor with invalid data', async () => {
            const invalidData = { name: '' };
            Vendor.create.mockRejectedValue(new Error('Validation error'));
            
            await expect(repository.create(invalidData)).rejects.toThrow('Validation error');
            expect(Vendor.create).toHaveBeenCalledWith(invalidData);
        });
        
        // Edge case
        it('should handle creating vendor with minimum required fields', async () => {
            const minimalData = { name: 'Minimal Vendor' };
            const createdVendor = { ...minimalData, id: 3, get: jest.fn(() => ({ ...minimalData, id: 3 })) };
            Vendor.create.mockResolvedValue(createdVendor);
            
            const result = await repository.create(minimalData);
            
            expect(Vendor.create).toHaveBeenCalledWith(minimalData);
            expect(result).toEqual({ ...minimalData, id: 3 });
        });
    });
});