const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.describe("Onboarding guard rails", () => {
  test("budget screen does not write forbidden buyer_profiles price columns", async () => {
    const file = path.join(
      process.cwd(),
      "src",
      "screens",
      "onboarding",
      "BuyerPriceRangeScreen.jsx",
    );
    const code = fs.readFileSync(file, "utf8");
    expect(code.includes("price_range_min")).toBeFalsy();
    expect(code.includes("price_range_max")).toBeFalsy();
  });

  test("budget continue path uses temporary buyer completion shortcut", async () => {
    const contextFile = path.join(
      process.cwd(),
      "src",
      "context",
      "OnboardingContext.jsx",
    );
    const screenFile = path.join(
      process.cwd(),
      "src",
      "screens",
      "onboarding",
      "BuyerPriceRangeScreen.jsx",
    );
    const contextCode = fs.readFileSync(contextFile, "utf8");
    const screenCode = fs.readFileSync(screenFile, "utf8");

    expect(contextCode.includes("completeBuyerOnboardingMock")).toBeTruthy();
    expect(screenCode.includes("completeBuyerOnboardingMock")).toBeTruthy();
  });
});
