/**
 * xaven-factory.ts
 *
 */

import express, { Request, Response, NextFunction } from "express";
import axios from "axios";
import NodeCache from "node-cache";
import { z } from "zod";
import pLimit from "p-limit";
import winston from "winston";

// -------------------- 1) CONFIG & SETUP --------------------

// Winston logger setup
const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Simple in-memory cache (time-to-live: 10 seconds, check every 20)
const cache = new NodeCache({ stdTTL: 10, checkperiod: 20 });

// Concurrency limiter allowing up to 3 parallel external requests
const limit = pLimit(3);

// Express initialization
const app = express();
app.use(express.json());

const EXTERNAL_API_URL = "https://api.xavenai.com/";

// -------------------- 2) CUSTOM ERROR CLASS --------------------

/** Custom error for domain-level or business-logic failures. */
class XavenError extends Error {
    public statusCode: number;
    public details: any;

    constructor(message: string, statusCode = 400, details?: any) {
        super(message);
        this.name = "XavenError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

// -------------------- 3) REQUEST VALIDATION SCHEMAS --------------------

// Zod schema for GET /post-by-id
const postByIdQuerySchema = z.object({
    postId: z.string().regex(/^\d+$/, "postId must be a numeric string")
});

// Zod schema for POST /bulk-fetch
const bulkFetchSchema = z.object({
    postIds: z.array(z.number()).nonempty("Must provide at least one postId.")
});

// -------------------- 4) UTILITY & SERVICE FUNCTIONS --------------------

/**
 * A generic typed fetch function, respecting concurrency limits and caching.
 * @param url  The URL to fetch.
 * @returns    Parsed JSON response.
 */
async function fetchWithCache<T>(url: string): Promise<T> {
    // 1. Check in cache
    const cached = cache.get<T>(url);
    if (cached) {
        logger.info(`Cache HIT for ${url}`);
        return cached;
    }

    // 2. Otherwise, do a concurrency-limited request
    return limit(async () => {
        logger.info(`Cache MISS, fetching ${url}`);
        const response = await axios.get<T>(url);
        // Cache the response data
        cache.set(url, response.data);
        return response.data;
    });
}

/**
 * Fetches one post by ID from the external API.
 */
async function getPostById(id: number) {
    const url = `${EXTERNAL_API_URL}/${id}`;
    const data = await fetchWithCache<any>(url);
    // In real production code, define a Post type: e.g., `interface Post { userId: number; id: number; ... }`
    return data;
}

/**
 * Fetches multiple posts at once (in parallel) using concurrency limit.
 */
async function getPostsInBulk(ids: number[]): Promise<any[]> {
    const promises = ids.map((id) => getPostById(id));
    return Promise.all(promises);
}

// -------------------- 5) ROUTES --------------------

// GET /post-by-id?postId=123
app.get("/post-by-id", async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validate query
        const { postId } = postByIdQuerySchema.parse(req.query);
        const numericId = parseInt(postId, 10);

        // Business logic: fetch external data
        const post = await getPostById(numericId);
        if (!post) {
            throw new XavenError(`Post with ID ${postId} not found`, 404);
        }

        return res.json({ success: true, data: post });
    } catch (error) {
        next(error);
    }
});

// POST /bulk-fetch
//  { "postIds": [1, 2, 3] }
app.post("/bulk-fetch", async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validate request body
        const { postIds } = bulkFetchSchema.parse(req.body);

        // In production, you might do further checks here (permissions, rate-limits, etc.)
        const posts = await getPostsInBulk(postIds);

        return res.json({ success: true, count: posts.length, data: posts });
    } catch (error) {
        next(error);
    }
});

// -------------------- 6) ERROR HANDLING MIDDLEWARE --------------------

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof XavenError) {
        logger.error(`XavenError: ${error.message}`, { details: error.details });
        return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            details: error.details
        });
    }

    if (error?.name === "ZodError") {
        // Validation error from zod
        logger.error(`ValidationError: ${error.message}`, { issues: error.issues });
        return res.status(400).json({
            success: false,
            error: "Validation failed",
            issues: error.issues
        });
    }

    logger.error(`UnhandledError: ${error?.message || "Unknown error"}`, { error });
    return res.status(500).json({
        success: false,
        error: "Internal Server Error"
    });
});

// -------------------- 7) SERVER STARTUP --------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Xaven Factory service started on port ${PORT}`);
});
