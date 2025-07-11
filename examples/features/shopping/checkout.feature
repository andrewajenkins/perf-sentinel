@shopping @checkout @medium
Feature: Shopping Cart Checkout
  As a customer
  I want to checkout my shopping cart
  So that I can complete my purchase

  Background:
    Given I have items in my shopping cart
    And I am logged in

  @smoke @payment
  Scenario: Successful checkout with credit card
    Given I am on the checkout page
    When I select credit card as payment method
    And I enter valid credit card details
    And I click the complete purchase button
    Then I should see order confirmation
    And I should receive a confirmation email

  @regression @slow @payment
  Scenario: Checkout with invalid credit card
    Given I am on the checkout page
    When I select credit card as payment method
    And I enter invalid credit card details
    And I click the complete purchase button
    Then I should see a payment error message
    And I should remain on the checkout page

  @integration @shipping
  Scenario: Checkout with different shipping options
    Given I am on the checkout page
    When I select express shipping
    And I enter valid payment details
    And I click the complete purchase button
    Then I should see order confirmation with express shipping
    And the total should include shipping costs 