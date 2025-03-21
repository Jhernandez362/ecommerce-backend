
// @ts-ignore
const stripe = require("stripe")(process.env.STRIPE_KEY)

/**
 * order controller
 */


import { factories } from '@strapi/strapi'

//export default factories.createCoreController('api::order.order');

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        const { products } = ctx.request.body;
        console.log("Receiving products:", products);

        try {
            const lineItems = await Promise.all(
                products.map(async (product) => {
                    console.log("Searching for a product on Strapi with a slug:", product.slug);
                    const item = await strapi.entityService.findMany("api::product.product", {
                        filters: { slug: product.slug },
                        limit: 1,
                      });

                    if (!item) {
                        console.error("Product not found on Strapi:", product.slug);
                        throw new Error(`Producto con ID ${product.id} no encontrado`);
                    }

                    return {
                        price_data: {
                            currency: "USD",
                            product_data: {
                                name: item[0].name
                            },
                            unit_amount: Math.round(item[0].price * 100),
                        },
                        quantity: 1
                    };
                })
            );

            console.log("Line items generated:", lineItems);

            const session = await stripe.checkout.sessions.create({
                shipping_address_collection: { allowed_countries: ["ES"] },
                payment_method_types: ["card"],
                mode: "payment",
                success_url: process.env.CLIENT_URL + "/success",
                cancel_url: process.env.CLIENT_URL + "/successError",
                line_items: lineItems
            });

            console.log("Stripe session created:", session.id);

            await strapi.service("api::order.order").create({
                data: { products, stripeId: session.id }
            });

            return { stripeSession: session };
        } catch (error) {
            console.error("Error en create:", error);
            ctx.response.status = 500;
            return { error: error.message };
        }
    }
}));
