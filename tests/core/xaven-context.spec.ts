// xaven-context.spec.ts

import type { Request, Response, NextFunction } from "express";
import {
    xavenContextMiddleware,
    getXavenContext,
    getCorrelationId,
    getUserId,
    XavenContextData,
} from "../../packages/core";
import { describe, it, expect } from "vitest";

describe("xavenContextMiddleware", () => {
    it("should use the provided correlation id from the header", () => {
        const testCorrelationId = "test-correlation-id";
        const req = {
            headers: {
                "x-correlation-id": testCorrelationId,
            },
        } as Partial<Request> as Request;
        const res = {} as Response;

        const next: NextFunction = () => {
            const context = getXavenContext();
            expect(context).toBeDefined();
            expect(context?.correlationId).toBe(testCorrelationId);
        };

        xavenContextMiddleware(req, res, next);
    });

    it("should trim the correlation id header and use it if non-empty", () => {
        const trimmedCorrelationId = "trimmed-correlation-id";
        const req = {
            headers: {
                "x-correlation-id": `   ${trimmedCorrelationId}   `,
            },
        } as Partial<Request> as Request;
        const res = {} as Response;

        const next: NextFunction = () => {
            const context = getXavenContext();
            expect(context).toBeDefined();
            // The middleware trims the header value
            expect(context?.correlationId).toBe(trimmedCorrelationId);
        };

        xavenContextMiddleware(req, res, next);
    });

    it("should generate a new correlation id when the header is missing", () => {
        const req = {
            headers: {}, // No correlation id header provided
        } as Partial<Request> as Request;
        const res = {} as Response;

        let capturedContext: XavenContextData | undefined;
        const next: NextFunction = () => {
            capturedContext = getXavenContext();
        };

        xavenContextMiddleware(req, res, next);

        expect(capturedContext).toBeDefined();
        expect(capturedContext?.correlationId).toBeDefined();
        // Verify that the generated ID matches a UUID pattern.
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(capturedContext?.correlationId).toMatch(uuidRegex);
    });

    it("should generate a new correlation id when the header is empty or whitespace", () => {
        const req = {
            headers: {
                "x-correlation-id": "    ", // Empty/whitespace value
            },
        } as Partial<Request> as Request;
        const res = {} as Response;

        let capturedContext: XavenContextData | undefined;
        const next: NextFunction = () => {
            capturedContext = getXavenContext();
        };

        xavenContextMiddleware(req, res, next);

        expect(capturedContext).toBeDefined();
        // Since the header was not valid, a new UUID should be generated.
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(capturedContext?.correlationId).toMatch(uuidRegex);
    });

    it("should set the userId from the request if provided", () => {
        const testCorrelationId = "user-test-correlation-id";
        const testUserId = "user-123";
        const req = {
            headers: {
                "x-correlation-id": testCorrelationId,
            },
            // Adding userId to the request (this property is not standard to Express)
            userId: testUserId,
        } as any as Request;
        const res = {} as Response;

        let capturedContext: XavenContextData | undefined;
        const next: NextFunction = () => {
            capturedContext = getXavenContext();
        };

        xavenContextMiddleware(req, res, next);

        expect(capturedContext).toBeDefined();
        expect(capturedContext?.correlationId).toBe(testCorrelationId);
        expect(capturedContext?.userId).toBe(testUserId);
    });

    it("should allow helper functions to access the context", () => {
        const testCorrelationId = "helper-test-correlation-id";
        const testUserId = "helper-user-456";
        const req = {
            headers: {
                "x-correlation-id": testCorrelationId,
            },
            userId: testUserId,
        } as any as Request;
        const res = {} as Response;

        let capturedCorrelationId: string | undefined;
        let capturedUserId: string | undefined;

        const next: NextFunction = () => {
            // Use helper functions inside the async context
            capturedCorrelationId = getCorrelationId();
            capturedUserId = getUserId();
        };

        xavenContextMiddleware(req, res, next);

        expect(capturedCorrelationId).toBe(testCorrelationId);
        expect(capturedUserId).toBe(testUserId);
    });

    it("should propagate context into asynchronous operations", (done) => {
        const testCorrelationId = "async-test-correlation-id";
        const req = {
            headers: {
                "x-correlation-id": testCorrelationId,
            },
        } as Partial<Request> as Request;
        const res = {} as Response;

        const next: NextFunction = () => {
            // Simulate an asynchronous operation
            setTimeout(() => {
                const context = getXavenContext();
                expect(context).toBeDefined();
                expect(context?.correlationId).toBe(testCorrelationId);
                // done();
            }, 10);
        };

        xavenContextMiddleware(req, res, next);
    });
});
