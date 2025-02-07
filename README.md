# Xaven SDK &middot; ![npm](https://img.shields.io/badge/npm-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green)

**Xaven SDK** is a TypeScript library that streamlines **AI-driven e-commerce** recommendations by **optimizing user purchases** across multiple partner platforms. Through a combination of **machine learning inference**, **concurrency-limited fetching**, and **price-shipping balancing**, developers can embed a optimized shopping experience into their applications.

---

## Core Features

1. **AI Query Understanding**  
   - Parse user input with advanced ML-based textual analysis to extract product, brand, and budget constraints.  
   - Automatically refine ambiguous queries into actionable search parameters.

2. **Concurrent Data Fetch & Orchestration**  
   - Perform parallel retrieval of product details from partner APIs, throttled by concurrency guards (e.g., p-limit).  
   - Resolve potential rate-limit issues via dynamic scheduling, ensuring stable high-load performance.

3. **Purchase Optimization Engine**  
   - Combine real-time price checks, shipping cost evaluation, and historical preference data to rank offers.  
   - Minimize “total cost of ownership” by factoring in discount codes, membership perks, or seasonal deals.

4. **Context-Aware Caching**  
   - Reduce redundant calls with integrated in-memory caching or pluggable Redis layers.  
   - Context-based strategy: store correlation IDs, user sessions, or ephemeral queries for multi-step purchases.

---

## Installation

```bash
npm install xaven-sdk
```

---

## Usage

```ts
import { xavenAiEngine, xavenPurchaseOptimizer } from "xaven-sdk";

// 1. AI parse user desire
const userQuery = "Need a high-end laptop under 1500";
const aiParsed = await xavenAiEngine.parse(userQuery);

// 2. Optimize purchase
const bestOffer = await xavenPurchaseOptimizer.getBestRecommendation(aiParsed);

console.log("Optimal e-commerce partner:", bestOffer.partnerName);
console.log("Price (including shipping):", bestOffer.totalPrice);
```

## Advanced Configuration

| Env Variable                    | Default  | Description                                           |
|--------------------------------|----------|-------------------------------------------------------|
| \`XAVEN_CONCURRENCY_LIMIT\`    | \`5\`      | Maximum parallel queries to partner APIs.             |
| \`XAVEN_CACHE_TTL\`            | \`120\`    | Caching duration (seconds) for repeated requests.     |
| \`XAVEN_AI_MODEL\`             | \`qwen2.5\` | Preferred reasoning model to interpret user queries.  |
| \`XAVEN_LOG_LEVEL\`            | \`info\`   | Logging verbosity for debugging aggregator flows.     |

---

## Getting Involved

We welcome feedback and pull requests! Please adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md).  
Feel free to open issues, propose new features, or share your ideas on optimizing the user’s purchasing journey with **Xaven SDK**.

© 2025 Xaven Labs. Released under the MIT License.
