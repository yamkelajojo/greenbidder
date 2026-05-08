const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.describe("UI polish guard rails", () => {
  test("welcome carousel uses provided onboarding image assets", async () => {
    const file = path.join(
      process.cwd(),
      "src",
      "screens",
      "onboarding",
      "WelcomeCarousel.jsx",
    );
    const code = fs.readFileSync(file, "utf8");
    expect(code.includes("assets/onboarding/ai-scan.png")).toBeTruthy();
    expect(code.includes("assets/onboarding/personalized-feed.png")).toBeTruthy();
    expect(code.includes("assets/onboarding/market-chart.png")).toBeTruthy();
  });

  test("buyer preferences relies on CATEGORY_ICONS-backed hook", async () => {
    const hookFile = path.join(
      process.cwd(),
      "src",
      "hooks",
      "useCategorySelection.js",
    );
    const screenFile = path.join(
      process.cwd(),
      "src",
      "screens",
      "onboarding",
      "BuyerPreferencesScreen.jsx",
    );
    const hookCode = fs.readFileSync(hookFile, "utf8");
    const screenCode = fs.readFileSync(screenFile, "utf8");
    expect(hookCode.includes("CATEGORY_ICONS")).toBeTruthy();
    expect(screenCode.includes("item.icon")).toBeTruthy();
  });

  test("farmer listing image flows enforce camera-only policy", async () => {
    const imageServiceFile = path.join(
      process.cwd(),
      "src",
      "services",
      "imageService.js",
    );
    const createFile = path.join(
      process.cwd(),
      "src",
      "screens",
      "farmer",
      "CreateListingScreen.jsx",
    );
    const editFile = path.join(
      process.cwd(),
      "src",
      "screens",
      "farmer",
      "EditListingScreen.jsx",
    );

    const imageServiceCode = fs.readFileSync(imageServiceFile, "utf8");
    const createCode = fs.readFileSync(createFile, "utf8");
    const editCode = fs.readFileSync(editFile, "utf8");

    expect(imageServiceCode.includes("policy = \"default\"")).toBeTruthy();
    expect(imageServiceCode.includes("camera_only")).toBeTruthy();
    expect(createCode.includes("pickImage(\"camera\", \"camera_only\")")).toBeTruthy();
    expect(editCode.includes("pickImage(\"camera\", \"camera_only\")")).toBeTruthy();
  });
});
