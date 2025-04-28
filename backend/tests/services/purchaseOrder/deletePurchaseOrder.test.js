const { of, throwError } = require('rxjs');
const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const Sentry = require('../../../src/instrument');

jest.mock('../../../src/instrument', () => ({
    captureException: jest.fn(),
    addBreadcrumb: jest.fn()
}));

jest.mock('../../../src/repositories/purchaseOrderRepository', () => {
    return jest.fn().mockImplementation(() => ({
        delete: jest.fn(),
        findById: jest.fn()
    }));
});

jest.mock('rxjs', () => {
    const original = jest.requireActual('rxjs');
    return {
        ...original,
        from: jest.fn()
    };
});

describe('deletePurchaseOrderById', () => {
    const { from } = require('rxjs');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should delete a purchase order successfully', async () => {
        const mockId = 'po-123';
        from.mockImplementation((input) => {
            if (typeof input === 'function' || input instanceof Promise) {
                return of(undefined);
            }
            return of(1);
        });

        const result = await purchaseOrderService.deletePurchaseOrderById(mockId).toPromise();

        expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
        expect(result).toEqual({ message: 'Purchase order successfully deleted' });
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });
});
