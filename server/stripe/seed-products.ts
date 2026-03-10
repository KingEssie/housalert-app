import { getUncachableStripeClient } from "./stripeClient";

async function seedStripeProducts() {
  const stripe = await getUncachableStripeClient();

  console.log("[stripe-seed] Creating HousAlert product...");

  const existingProducts = await stripe.products.list({ limit: 10 });
  let product = existingProducts.data.find(p => p.name === "HousAlert Abonnement");

  if (!product) {
    product = await stripe.products.create({
      name: "HousAlert Abonnement",
      description: "Erhalte sofort Benachrichtigungen über neue Mietwohnungen in Deutschland",
    });
    console.log(`[stripe-seed] Created product: ${product.id}`);
  } else {
    console.log(`[stripe-seed] Product already exists: ${product.id}`);
  }

  const existingPrices = await stripe.prices.list({ product: product.id, limit: 20, active: true });

  const plans = [
    { nickname: "monthly", unit_amount: 1499, interval: "month" as const, interval_count: 1 },
    { nickname: "two_month", unit_amount: 2499, interval: "month" as const, interval_count: 2 },
    { nickname: "three_month", unit_amount: 2999, interval: "month" as const, interval_count: 3 },
  ];

  const priceIds: Record<string, string> = {};

  for (const plan of plans) {
    const existing = existingPrices.data.find(p =>
      p.nickname === plan.nickname && p.unit_amount === plan.unit_amount
    );

    if (existing) {
      console.log(`[stripe-seed] Price ${plan.nickname} already exists: ${existing.id}`);
      priceIds[plan.nickname] = existing.id;
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        nickname: plan.nickname,
        unit_amount: plan.unit_amount,
        currency: "eur",
        recurring: {
          interval: plan.interval,
          interval_count: plan.interval_count,
        },
      });
      console.log(`[stripe-seed] Created price ${plan.nickname}: ${price.id}`);
      priceIds[plan.nickname] = price.id;
    }
  }

  console.log("\n[stripe-seed] === SET THESE ENV VARS ===");
  console.log(`STRIPE_PRICE_MONTHLY=${priceIds.monthly}`);
  console.log(`STRIPE_PRICE_TWO_MONTH=${priceIds.two_month}`);
  console.log(`STRIPE_PRICE_THREE_MONTH=${priceIds.three_month}`);
  console.log("========================================\n");

  return priceIds;
}

seedStripeProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[stripe-seed] Error:", err);
    process.exit(1);
  });
