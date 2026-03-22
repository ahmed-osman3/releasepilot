// Token bucket rate limiter for ASC API (5 req/sec sustained)
const CAPACITY = 5;
const REFILL_RATE = 5; // tokens per second

let tokens = CAPACITY;
let lastRefill = Date.now();

function refill() {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  tokens = Math.min(CAPACITY, tokens + elapsed * REFILL_RATE);
  lastRefill = now;
}

export async function acquireToken(): Promise<void> {
  refill();

  if (tokens >= 1) {
    tokens -= 1;
    return;
  }

  // Wait until a token is available
  const waitMs = ((1 - tokens) / REFILL_RATE) * 1000;
  await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitMs)));
  refill();
  tokens -= 1;
}
