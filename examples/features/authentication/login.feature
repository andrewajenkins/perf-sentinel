@authentication @critical
Feature: User Authentication
  As a user of the application
  I want to be able to log in securely
  So that I can access my account

  Background:
    Given the application is running

  @smoke @fast
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter valid username and password
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see my account information

  @regression @slow
  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter invalid username and password
    And I click the login button
    Then I should see an error message
    And I should remain on the login page

  @security @critical
  Scenario: Account lockout after multiple failed attempts
    Given I am on the login page
    When I attempt to login with wrong credentials 5 times
    Then my account should be locked
    And I should see a lockout message 