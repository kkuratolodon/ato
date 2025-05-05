Feature: Get Purchase Order Status
  As a partner
  I want to check the status of my purchase order
  So that I can know whether it has been processed successfully

  Background:
    Given a valid authenticated user for purchase order status

  Scenario: Successfully get the status of an analyzed purchase order
    Given a purchase order "po-123" exists with "Analyzed" status
    When the user requests status for purchase order "po-123"
    Then the response status for purchase order should be 200
    And the response should contain purchase order "po-123" with status "Analyzed"

  Scenario: Successfully get the status of a processing purchase order
    Given a purchase order "po-456" exists with "Processing" status
    When the user requests status for purchase order "po-456"
    Then the response status for purchase order should be 200
    And the response should contain purchase order "po-456" with status "Processing"

  Scenario: Successfully get the status of a failed purchase order
    Given a purchase order "po-789" exists with "Failed" status
    When the user requests status for purchase order "po-789"
    Then the response status for purchase order should be 200
    And the response should contain purchase order "po-789" with status "Failed"

  Scenario: Attempt to get the status of a non-existent purchase order
    Given the purchase order "invalid-id" does not exist
    When the user requests status for purchase order "invalid-id"
    Then the response status for purchase order should be 404
    And the response message for purchase order should be "Purchase order not found"

  Scenario: Attempt to get the status of a purchase order belonging to another user
    Given the purchase order "other-user-po" belongs to another user
    When the user requests status for purchase order "other-user-po"
    Then the response status for purchase order should be 403
    And the response message for purchase order should be "Forbidden: You do not have access to this purchase order"

  Scenario: Attempt to get the status without authentication
    Given an unauthenticated user for purchase order status
    When the user requests status for purchase order "po-123"
    Then the response status for purchase order should be 401
    And the response message for purchase order should be "Unauthorized: Missing credentials"