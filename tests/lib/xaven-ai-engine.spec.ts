// xavenAiEngine.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { XavenAiEngine, XavenAiParsedResult } from "../../packages/lib/xaven-ai-engine";
import axios from "axios";

// --- Mock uuid so that all calls to uuidv4 return a fixed value ---
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-correlation-id"),
}));

// We'll create a fake Axios client that will be used by our engine.
let fakePost: ReturnType<typeof vi.fn>;
let fakeClient: any;

beforeEach(() => {
  fakePost = vi.fn();
  fakeClient = {
    post: fakePost,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  // Override axios.create so that our engine uses the fake client.
  vi.spyOn(axios, "create").mockReturnValue(fakeClient);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("XavenAiEngine", () => {
  it("should successfully parse user query on first attempt", async () => {
    const engine = new XavenAiEngine();
    const expectedResult: XavenAiParsedResult = {
      category: "laptop",
      brand: "Dell",
      maxBudget: 1500,
      shippingUrgency: "standard",
    };

    // Simulate a successful response on first call.
    fakePost.mockResolvedValueOnce({ data: expectedResult });

    const userQuery = "I need a new laptop";
    const result = await engine.parseUserQuery(userQuery);

    expect(result).toEqual(expectedResult);
    expect(fakePost).toHaveBeenCalledTimes(1);

    // Verify that the payload sent to the backend is as expected.
    // Note: Our engine sends { correlationId, userQuery, language }.
    const payload = fakePost.mock.calls[0][1]; // second argument of post()
    expect(payload).toEqual({
      correlationId: "test-correlation-id",
      userQuery,
      language: "en", // default language from config
    });
  });

  it("should use provided preferredLanguage if given", async () => {
    const engine = new XavenAiEngine({ defaultLanguage: "en" });
    const expectedResult: XavenAiParsedResult = {
      category: "phone",
      brand: "Apple",
      maxBudget: 1000,
      shippingUrgency: "expedited",
    };

    fakePost.mockResolvedValueOnce({ data: expectedResult });

    const userQuery = "I want an iPhone";
    const preferredLanguage = "es";
    const result = await engine.parseUserQuery(userQuery, preferredLanguage);

    expect(result).toEqual(expectedResult);
    expect(fakePost).toHaveBeenCalledTimes(1);

    const payload = fakePost.mock.calls[0][1];
    expect(payload).toEqual({
      correlationId: "test-correlation-id",
      userQuery,
      language: preferredLanguage,
    });
  });

  it("should retry on failure and succeed on a subsequent attempt", async () => {
    // Configure the engine to allow up to 3 attempts.
    const engine = new XavenAiEngine({ retryCount: 3 });
    const expectedResult: XavenAiParsedResult = {
      category: "tablet",
      brand: "Samsung",
      maxBudget: 800,
      shippingUrgency: "standard",
    };

    // First call fails, second call succeeds.
    const error = new Error("Network error");
    fakePost
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ data: expectedResult });

    const userQuery = "I need a tablet";
    const result = await engine.parseUserQuery(userQuery);

    expect(result).toEqual(expectedResult);
    expect(fakePost).toHaveBeenCalledTimes(2);
  });

  it("should throw an error after exhausting all retry attempts", async () => {
    // Set retryCount to 2 for this test.
    const retryCount = 2;
    const engine = new XavenAiEngine({ retryCount });
    const error = new Error("Service unavailable");

    // Make all attempts fail.
    fakePost.mockRejectedValue(error);

    const userQuery = "I need a smartwatch";
    await expect(engine.parseUserQuery(userQuery)).rejects.toThrow(
      `[XavenAiEngine] parseUserQuery failed after ${retryCount} attempts. Last error: ${error.message}`
    );
    expect(fakePost).toHaveBeenCalledTimes(retryCount);
  });
});
