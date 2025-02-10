// xaven-factory.spec.ts

import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { app } from "../../packages/core/xaven-factory";
import axios from "axios";

// Mock axios so that external HTTP calls are intercepted.
vi.mock("axios");

// Reset mocks between tests.
beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /post-by-id", () => {
    it("returns post data when a valid postId is provided", async () => {
        const postId = "123";
        const numericId = 123;
        const postData = { id: numericId, title: "Test Post" };

        // When getPostById is called, it constructs the URL as `${EXTERNAL_API_URL}/${id}`.
        // We simulate a successful API response.
        (axios.get as any).mockResolvedValueOnce({ data: postData });

        const response = await request(app).get(`/post-by-id?postId=${postId}`);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(postData);
        expect(axios.get).toHaveBeenCalledWith(`https://api.xavenai.com/${numericId}`);
    });

    it("returns 400 when an invalid postId is provided", async () => {
        const response = await request(app).get("/post-by-id?postId=abc");
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // Our error handler returns "Validation failed" for Zod errors.
        expect(response.body.error).toBe("Validation failed");
        expect(response.body.issues).toBeDefined();
    });

    it("returns 404 when the post is not found", async () => {
        const postId = "456";
        const numericId = 456;
        // Simulate a response with a null data (post not found)
        (axios.get as any).mockResolvedValueOnce({ data: null });

        const response = await request(app).get(`/post-by-id?postId=${postId}`);
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe(`Post with ID ${postId} not found`);
    });
});

describe("POST /bulk-fetch", () => {
    it("returns posts for valid postIds", async () => {
        const postIds = [1, 2, 3];
        // Create sample post data for each id.
        const postsData = postIds.map((id) => ({ id, title: `Post ${id}` }));

        // Since getPostsInBulk calls getPostById for each id, we need to intercept each axios.get call.
        // Here we mock axios.get to return the proper post based on the URL.
        (axios.get as any).mockImplementation((url: string) => {
            // The URL is expected to be "https://api.xavenai.com/<id>"
            const idStr = url.split("/").pop();
            const id = Number(idStr);
            const post = postsData.find((p) => p.id === id);
            return Promise.resolve({ data: post });
        });

        const response = await request(app)
            .post("/bulk-fetch")
            .send({ postIds });
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.count).toBe(postIds.length);
        expect(response.body.data).toEqual(postsData);
    });

    it("returns 400 when postIds array is empty", async () => {
        const response = await request(app)
            .post("/bulk-fetch")
            .send({ postIds: [] });
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe("Validation failed");
        expect(response.body.issues).toBeDefined();
    });
});

describe("Caching behavior", () => {
    it("should cache the response for GET /post-by-id", async () => {
        const postId = "789";
        const numericId = 789;
        const postData = { id: numericId, title: "Cached Post" };

        // For the first call, simulate a cache miss.
        (axios.get as any).mockResolvedValueOnce({ data: postData });

        // First request: should call axios.get.
        const res1 = await request(app).get(`/post-by-id?postId=${postId}`);
        expect(res1.status).toBe(200);
        expect(res1.body.data).toEqual(postData);

        // Second request: should hit the cache so axios.get is not called again.
        const res2 = await request(app).get(`/post-by-id?postId=${postId}`);
        expect(res2.status).toBe(200);
        expect(res2.body.data).toEqual(postData);

        // Verify that axios.get was called only once.
        expect(axios.get).toHaveBeenCalledTimes(1);
    });
});
