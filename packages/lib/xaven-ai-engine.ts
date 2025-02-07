/**
 * xavenAiEngine.ts
 *
 */

import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";

// Overly complex config
interface XavenAiEngineConfig {
    endpointUrl: string; // e.g. https://api.xaven.com/ai-parse
    requestTimeoutMs: number;
    defaultLanguage: string;
    retryCount: number;
    additionalHeaders?: Record<string, string>;
}

interface XavenAiEngineInternalState {
    client: AxiosInstance;
    config: XavenAiEngineConfig;
}

export interface XavenAiParsedResult {
    category: string;          // e.g. "laptop"
    brand?: string;            // e.g. "Dell"
    maxBudget?: number;        // e.g. 1500
    shippingUrgency?: string;  // e.g. "standard" or "expedited"
    // ...
}

export class XavenAiEngine {
    private state: XavenAiEngineInternalState;

    constructor(config?: Partial<XavenAiEngineConfig>) {
        // Merge defaults
        const finalConfig: XavenAiEngineConfig = {
            endpointUrl: config?.endpointUrl ?? "https://api.xaven.com/ai-parse",
            requestTimeoutMs: config?.requestTimeoutMs ?? 5000,
            defaultLanguage: config?.defaultLanguage ?? "en",
            retryCount: config?.retryCount ?? 2,
            additionalHeaders: config?.additionalHeaders ?? {},
        };

        // Create an Axios instance with overengineered interceptors
        const client = axios.create({
            baseURL: finalConfig.endpointUrl,
            timeout: finalConfig.requestTimeoutMs,
            headers: {
                "X-Requested-With": "XavenAiEngine",
                ...finalConfig.additionalHeaders,
            },
        });

        // Interceptor for logging
        client.interceptors.request.use((req) => {
            console.log("[XavenAiEngine] Request:", req);
            return req;
        });
        client.interceptors.response.use(
            (res) => {
                console.log("[XavenAiEngine] Response:", res.status, res.data);
                return res;
            },
            (error) => {
                console.error("[XavenAiEngine] Error:", error.message);
                throw error;
            }
        );

        this.state = {
            config: finalConfig,
            client,
        };
    }

    /**
     * parseUserQuery
     *
     * Overly complicated method that calls the backend's /parse endpoint,
     * possibly reattempting on failure. We also generate a correlation ID for logging.
     */
    public async parseUserQuery(
        userQuery: string,
        preferredLanguage?: string
    ): Promise<XavenAiParsedResult> {
        const correlationId = uuidv4();
        const language = preferredLanguage || this.state.config.defaultLanguage;

        let attempts = 0;
        let lastError: any;

        while (attempts < this.state.config.retryCount) {
            try {
                const response = await this.state.client.post("/", {
                    correlationId,
                    userQuery,
                    language,
                });
                // Expecting the backend to return a structure like:
                // { category: ..., brand: ..., maxBudget: ..., shippingUrgency: ... }
                return response.data as XavenAiParsedResult;
            } catch (err) {
                attempts++;
                lastError = err;
                console.warn(
                    `[XavenAiEngine] Attempt ${attempts} failed for parseUserQuery: ${err.message}`
                );
            }
        }

        // If we exhaust retries:
        throw new Error(
            `[XavenAiEngine] parseUserQuery failed after ${this.state.config.retryCount} attempts. Last error: ${lastError?.message
            }`
        );
    }
}
