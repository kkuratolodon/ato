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

    /**
     * POSITIVE TEST CASES
     * Testing successful deletion scenarios
     */
    describe('Positive Cases', () => {
        test('should delete a purchase order successfully with UUID format ID', async () => {
            const mockId = '123e4567-e89b-12d3-a456-426614174000';
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

        test('should delete a purchase order successfully with numeric ID', async () => {
            const mockId = '12345';
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

        test('should delete a purchase order and log nothing on success', async () => {
            const mockId = 'po-123';
            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return of(1);
            });

            await purchaseOrderService.deletePurchaseOrderById(mockId).toPromise();

            expect(Sentry.captureException).not.toHaveBeenCalled();
        });
    });

    /**
     * NEGATIVE TEST CASES
     * Testing error scenarios
     */
    describe('Negative Cases', () => {
        test('should throw error when no purchase order is deleted', async () => {
            const mockId = 'nonexistent-po';
            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return of(0);
            });

            await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
                .rejects.toThrow('Failed to delete purchase order with ID: nonexistent-po');

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
                .rejects.toThrow('Database connection error');

            expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
            expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
        });

        test('should throw error when server times out', async () => {
            const mockId = 'po-123';
            const mockError = new Error('Request timeout');

            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return throwError(() => mockError);
            });

            await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
                .rejects.toThrow('Request timeout');

            expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
            expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
        });

        test('should throw error when authorization fails', async () => {
            const mockId = 'po-123';
            const mockError = new Error('Authorization failed');

            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return throwError(() => mockError);
            });

            await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
                .rejects.toThrow('Authorization failed');

            expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
            expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
        });
    });

    /**
     * CORNER CASES
     * Testing edge scenarios with unusual inputs
     */
    describe('Corner Cases', () => {
        test('should handle empty string ID gracefully', async () => {
            const mockId = '';
            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return of(0);
            });

            await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
                .rejects.toThrow(`Failed to delete purchase order with ID: ${mockId}`);

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
                .rejects.toThrow(`Failed to delete purchase order with ID: ${mockId}`);

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
                .rejects.toThrow(`Failed to delete purchase order with ID: ${mockId}`);

            expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        test('should handle extremely long ID', async () => {
            const mockId = 'a'.repeat(1000);
            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return of(0);
            });

            await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
                .rejects.toThrow(`Failed to delete purchase order with ID: ${mockId}`);

            expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        test('should handle ID with special characters', async () => {
            const mockId = 'po-123!@#$%^&*()';
            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return of(0);
            });

            await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
                .rejects.toThrow(`Failed to delete purchase order with ID: ${mockId}`);

            expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
            expect(Sentry.captureException).toHaveBeenCalled();
        });

        test('should handle ID with zero value', async () => {
            const mockId = '0';
            from.mockImplementation((input) => {
                if (typeof input === 'function' || input instanceof Promise) {
                    return of(undefined);
                }
                return of(0);
            });

            await expect(purchaseOrderService.deletePurchaseOrderById(mockId).toPromise())
                .rejects.toThrow(`Failed to delete purchase order with ID: ${mockId}`);

            expect(purchaseOrderService.purchaseOrderRepository.delete).toHaveBeenCalledWith(mockId);
            expect(Sentry.captureException).toHaveBeenCalled();
        });
    });
});