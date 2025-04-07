const { getMapper } = require('./setupAzureInvoiceMapper');

describe('Partner ID Generation', () => {
  test.each([
    ['Acme Corp Ltd.', 'acme-corp-ltd'],
    ['   Spaces   ', 'spaces'],
    ['', 'unknown-vendor'],
    [null, 'unknown-vendor'],
  ])('should generate %s as %s', (input, expected) => {
    const mapper = getMapper();
    expect(mapper.generatePartnerId(input)).toBe(expected);
  });

  it('should handle truncation for long names', () => {
    const mapper = getMapper();
    const longName = 'Really Long Company Name That Should Be Truncated To Fit Database Fields';
    expect(mapper.generatePartnerId(longName).length).toBeLessThanOrEqual(44);
  });
});