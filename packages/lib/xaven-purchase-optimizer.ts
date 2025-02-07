/**
 * xavenPurchaseOptimizer.ts
 *
 */

import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";
import { XavenAiParsedResult } from "./xaven-ai-engine";

// Overly complex config
interface XavenPurchaseOptimizerConfig {
    endpointUrl: string; // e.g. https://api.xaven.com/purchase-optimize
    requestTimeoutMs: number;
    concurrencyOverride?: number; // If we want to force concurrency from the client side
    enableCacheInvalidation?: boolean;
    retryCount: number;
    additionalHeaders?: Record<string, string>;
}

interface XavenPurchaseOptimizerInternalState {
    client: AxiosInstance;
    config: XavenPurchaseOptimizerConfig;
}

// The shape we expect from the backend aggregator
export interface XavenOptimizedOffer {
    partnerName: string;
    productName: string;
    price: number;
    shippingCost: number;
    shippingDays: number;
    brand?: string;
    totalCost: number; // e.g. price + shipping
    link: string;
}

export interface XavenOptimizationResult {
    bestOffer?: XavenOptimizedOffer;
    offers: XavenOptimizedOffer[];
}

export class XavenPurchaseOptimizer {
    private state: XavenPurchaseOptimizerInternalState;

    constructor(config?: Partial<XavenPurchaseOptimizerConfig>) {
        const finalConfig: XavenPurchaseOptimizerConfig = {
            endpointUrl:
                config?.endpointUrl ?? "https://api.xaven.com/purchase-optimize",
            requestTimeoutMs: config?.requestTimeoutMs ?? 7000,
            concurrencyOverride: config?.concurrencyOverride ?? undefined,
            enableCacheInvalidation: config?.enableCacheInvalidation ?? false,
            retryCount: config?.retryCount ?? 2,
            additionalHeaders: config?.additionalHeaders ?? {},
        };

        const client = axios.create({
            baseURL: finalConfig.endpointUrl,
            timeout: finalConfig.requestTimeoutMs,
            headers: {
                "X-Requested-With": "XavenPurchaseOptimizer",
                ...finalConfig.additionalHeaders,
            },
        });

        // Overengineer interceptors for demonstration
        client.interceptors.request.use((req) => {
            console.log("[XavenPurchaseOptimizer] Request:", req);
            return req;
        });
        client.interceptors.response.use(
            (res) => {
                console.log("[XavenPurchaseOptimizer] Response:", res.status, res.data);
                return res;
            },
            (error) => {
                console.error("[XavenPurchaseOptimizer] Error:", error.message);
                throw error;
            }
        );

        this.state = {
            config: finalConfig,
            client,
        };
    }

    /**
     * optimizePurchase
     *
     * Calls to optimize the user’s purchase,
     * passing in the AI parse result plus optional overrides.
     */
    public async optimizePurchase(
        aiParsed: XavenAiParsedResult,
        userId?: string
    ): Promise<XavenOptimizationResult> {
        const correlationId = uuidv4();
        let attempts = 0;
        let lastError: any;

        while (attempts < this.state.config.retryCount) {
            try {
                const response = await this.state.client.post("/", {
                    correlationId,
                    userId,
                    payload: {
                        aiParsed, // the structured info from XavenAiEngine
                        concurrency: this.state.config.concurrencyOverride,
                        cacheInvalidation: this.state.config.enableCacheInvalidation,
                    },
                });

                // Expecting the backend to return something like:
                // {
                //   bestOffer: { partnerName, productName, ... },
                //   offers: [...]
                // }
                return response.data as XavenOptimizationResult;
            } catch (err) {
                attempts++;
                lastError = err;
                console.warn(
                    `[XavenPurchaseOptimizer] Attempt ${attempts} failed for optimizePurchase: ${err.message}`
                );
            }
        }

        throw new Error(
            `[XavenPurchaseOptimizer] optimizePurchase failed after ${this.state.config.retryCount} attempts. Last error: ${lastError?.message
            }`
        );
    }

    /**
     * forceCacheInvalidation
     */
    public async forceCacheInvalidation(reason: string) {
        if (!this.state.config.enableCacheInvalidation) {
            console.log(
                "[XavenPurchaseOptimizer] Cache invalidation is disabled in config."
            );
            return;
        }

        try {
            const response = await this.state.client.delete("/cache", {
                data: { reason },
            });
            console.log("[XavenPurchaseOptimizer] Cache invalidation response:", response.data);
        } catch (err) {
            console.error("[XavenPurchaseOptimizer] Could not invalidate cache:", err);
            // maybe re-throw or handle
        }
    }
}
