import Stripe from 'stripe';
import type { Env } from '../api/raindrop.gen';

export class PaymentService {
    private stripe: Stripe;
    private env: Env;

    constructor(env: Env) {
        this.env = env;
        // We assume STRIPE_SECRET_KEY is bound in Env, though not explicitly in the type yet
        // Raindrop secrets land in env object at runtime
        const apiKey = (env as any).STRIPE_SECRET_KEY;
        if (!apiKey) {
            console.warn('STRIPE_SECRET_KEY is missing');
        }
        this.stripe = new Stripe(apiKey || 'dummy', {
            apiVersion: '2025-12-15.clover',
            httpClient: Stripe.createFetchHttpClient(),
        });
    }

    /**
     * Create a checkout session for upgrading to Pro
     */
    async createCheckoutSession(params: {
        customerId?: string;
        userId: string;
        email: string;
        successUrl: string;
        cancelUrl: string;
    }) {
        const priceId = (this.env as any).STRIPE_PRICE_ID;
        if (!priceId) throw new Error('STRIPE_PRICE_ID is missing');

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${params.successUrl}${params.successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: params.cancelUrl,
            client_reference_id: params.userId,
            customer_email: params.customerId ? undefined : params.email,
            customer: params.customerId,
            metadata: {
                userId: params.userId,
            },
        };

        return await this.stripe.checkout.sessions.create(sessionParams);
    }

    /**
     * Create a customer portal session for managing subscription
     */
    async createPortalSession(customerId: string, returnUrl: string) {
        return await this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
    }

    /**
     * Construct webhook event from raw signature
     */
    async constructEvent(body: string, sig: string) {
        const endpointSecret = (this.env as any).STRIPE_WEBHOOK_SECRET;
        if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET is missing');

        return this.stripe.webhooks.constructEvent(body, sig, endpointSecret);
    }

    /**
     * Retrieve customer details
     */
    async getCustomer(customerId: string) {
        return await this.stripe.customers.retrieve(customerId);
    }

    /**
     * Verify a checkout session
     */
    async verifySession(sessionId: string) {
        const session = await this.stripe.checkout.sessions.retrieve(sessionId);
        return {
            status: session.status,
            paymentStatus: session.payment_status,
            customerId: session.customer,
            userId: session.metadata?.userId || session.client_reference_id as string,
            email: session.customer_details?.email || session.customer_email
        };
    }
}
