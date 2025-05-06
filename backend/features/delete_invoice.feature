Feature: Delete Invoice
  As a partner
  I want to delete an invoice
  So that I can remove unwanted or erroneous invoices from the system

  Background:
    Given a valid authenticated user

  Scenario: Successfully delete an invoice with a file
    Given an invoice "invoice-123" exists and is deletable
    When the user deletes invoice with ID "invoice-123"
    Then the response status should be 200
    And the response message should be "Invoice successfully deleted"

  Scenario: Successfully delete an invoice without a file
    Given an invoice "invoice-456" exists and has no file
    When the user deletes invoice with ID "invoice-456"
    Then the response status should be 200
    And the response message should be "Invoice successfully deleted"

  Scenario: Attempt to delete a non-existent invoice
    Given the invoice "invalid-id" does not exist
    When the user deletes invoice with ID "invalid-id"
    Then the response status should be 404
    And the response message should be "Invoice not found"

  Scenario: Attempt to delete an invoice belonging to another user
    Given the invoice "other-user-invoice" belongs to another user
    When the user deletes invoice with ID "other-user-invoice"
    Then the response status should be 403
    And the response message should be "Unauthorized: You do not own this invoice"

  Scenario: Attempt to delete an invoice that is not in Analyzed status
    Given the invoice "pending-invoice" is not in analyzed state
    When the user deletes invoice with ID "pending-invoice"
    Then the response status should be 409
    And the response message should be "Invoice cannot be deleted unless it is Analyzed"

  Scenario: Attempt to delete an invoice with S3 file deletion failure
    Given the invoice "s3-error-invoice" has a file but S3 deletion fails
    When the user deletes invoice with ID "s3-error-invoice"
    Then the response status should be 500
    And the response message should be "Failed to delete file from S3"