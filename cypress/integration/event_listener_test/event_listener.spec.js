describe("Event listeners", () => {
    function clickOnTestEventButton(cy) {
        return cy.get("#testFrame").then(function($iframe) {
            const doc = $iframe.contents();
            const button = doc.find("#test-event");
            cy.wrap(button).click();
        });
    }

    it("should work", () => {
        cy.visit("http://localhost:8080/event_listener_test");
        cy.wait(1000); // waiting for the iframe to load
        clickOnTestEventButton(cy)
            .then(() => {
                cy.get("#result").contains("On click: 0");
            })
            .get("#stop-listening")
            .click();
        clickOnTestEventButton(cy).then(() => {
            cy.get("#result").contains("On click: 0");
        });
    });
});
