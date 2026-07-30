/// <reference types="cypress" />

describe('Voyagenie commercial journeys', () => {
  it('shows the commercial home page with destinations and packages', () => {
    cy.visit('/');
    cy.contains('h1', 'Plan the trip you actually want');
    cy.get('[data-testid="destination-card"]').should('have.length.at.least', 3);
    cy.get('[data-testid="package-card"]').should('have.length.at.least', 1);
  });

  it('searches a destination and opens its detail page', () => {
    cy.visit('/');
    cy.get('[data-testid="hero-search"]').type('Singapore');
    cy.contains('button', 'Search').click();
    cy.location('pathname').should('eq', '/destinations');
    cy.get('[data-testid="destination-card"]').first().contains('Explore').click();
    cy.contains('h2', 'Overview');
    cy.contains('Top attractions');
  });

  it('filters destinations by budget level', () => {
    cy.visit('/destinations');
    cy.get('#budget').select('low');
    // Wait for the filtered render before asserting, so no stale cards are inspected.
    cy.get('[data-testid="result-count"] strong').should('not.have.text', '12');
    cy.get('[data-testid="destination-card"]').each(($card) => {
      expect($card.text()).to.contain('low budget');
    });
  });

  it('browses the package catalogue', () => {
    cy.visit('/packages');
    cy.get('[data-testid="package-card"]').should('have.length.at.least', 5);
    cy.contains('button', 'luxury').click();
    cy.get('[data-testid="package-card"]').should('have.length.at.least', 1);
  });

  it('submits a contact inquiry and persists it', () => {
    cy.visit('/contact');
    cy.get('#name').type('Cypress Tester');
    cy.get('#email').type('cypress@example.com');
    cy.get('#subject').type('Group booking');
    cy.get('#message').type('We are planning a group trip for eight people in November.');
    cy.contains('button', 'Send inquiry').click();
    cy.get('[data-testid="success-alert"]').should('contain', 'reference');
  });
});
