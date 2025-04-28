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

    test('should throw error when no purchase order is deleted', async () => {
        const mockId = 'nonexistent-po';
        from.mockImplementation((input) => {
            if (typeof input === 'function' || input instanceof Promise) {
                return of(undefined);
            }
            return of(0);
        });

        await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
            .rejects.toThrow('Failed to delete purchase order: Failed to delete purchase order with ID: nonexistent-po');

        expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    test('should throw error when deletion fails with database error', async () => {
        const mockId = 'po-123';
        const mockError = new Error('Database connection error');

        from.mockImplementation((input) => {
            if (typeof input === 'function' || input instanceof Promise) {
                return of(undefined);
            }
            return throwError(() => mockError);
        });

        await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
            .rejects.toThrow('Failed to delete purchase order: Database connection error');

        expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
        expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
    });

    test('should handle empty string ID gracefully', async () => {
        const mockId = '';
        from.mockImplementation((input) => {
            if (typeof input === 'function' || input instanceof Promise) {
                return of(undefined);
            }
            return of(0);
        });

        await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
            .rejects.toThrow(`Failed to delete purchase order: Failed to delete purchase order with ID: ${mockId}`);

        expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    test('should handle null ID gracefully', async () => {
        const mockId = null;
        from.mockImplementation((input) => {
            if (typeof input === 'function' || input instanceof Promise) {
                return of(undefined);
            }
            return of(0);
        });

        await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
            .rejects.toThrow(`Failed to delete purchase order: Failed to delete purchase order with ID: ${mockId}`);

        expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
        expect(Sentry.captureException).toHaveBeenCalled();
    });

    test('should handle undefined ID gracefully', async () => {
        const mockId = undefined;
        from.mockImplementation((input) => {
            if (typeof input === 'function' || input instanceof Promise) {
                return of(undefined);
            }
            return of(0);
        });

        await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
            .rejects.toThrow(`Failed to delete purchase order: Failed to delete purchase order with ID: ${mockId}`);

        expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
        expect(Sentry.captureException).toHaveBeenCalled();
    });
});
