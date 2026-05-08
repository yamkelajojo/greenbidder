const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test.describe("Onboarding motion architecture guards", () => {
  test("welcome carousel uses deep motion hook + continuous pager scroll", async () => {
    const file = path.join(
      process.cwd(),
      "src",
      "screens",
      "onboarding",
      "WelcomeCarousel.jsx",
    );
    const code = fs.readFileSync(file, "utf8");
    expect(code.includes("useOnboardingSlideMotion")).toBeTruthy();
    expect(code.includes("onPageScroll={handlePageScroll}")).toBeTruthy();
    expect(code.includes("motion.activateSlide(index)")).toBeTruthy();
  });

  test("deep motion hook defines enter/exit spec and replay activation", async () => {
    const file = path.join(
      process.cwd(),
      "src",
      "hooks",
      "useOnboardingSlideMotion.js",
    );
    const code = fs.readFileSync(file, "utf8");
    expect(code.includes("onboardingMotionSpec")).toBeTruthy();
    expect(code.includes("enterSpring")).toBeTruthy();
    expect(code.includes("exitSpring")).toBeTruthy();
    expect(code.includes("phaseOffsets")).toBeTruthy();
    expect(code.includes("activateSlide")).toBeTruthy();
  });

  test("progress bar consumes motion state and uses spring-based fill", async () => {
    const file = path.join(
      process.cwd(),
      "src",
      "components",
      "onboarding",
      "ProgressBar.jsx",
    );
    const code = fs.readFileSync(file, "utf8");
    expect(code.includes("motionState")).toBeTruthy();
    expect(code.includes("withSpring")).toBeTruthy();
    expect(code.includes("activeIndex")).toBeTruthy();
  });
});
