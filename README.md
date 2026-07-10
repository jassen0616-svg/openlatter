# openlatter

This project is a Next.js App Router implementation of the openlatter AI newsletter landing page and subscription workflow.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Vercel

Deploy the repository root as a standard Next.js project. No custom server is required.

Daily newsletter images are generated during the newsletter workflow, uploaded to the public Supabase Storage bucket configured by `NEWSLETTER_IMAGE_BUCKET`, and then referenced by the email HTML. `NEWSLETTER_DEFAULT_IMAGE_URL` is only the fallback image.

Welcome and daily emails contain a recipient-specific unsubscribe link. Set `SITE_URL` to the canonical production origin and generate a long random `UNSUBSCRIBE_SECRET` before deployment. The email link only opens a signed confirmation page; the subscriber status changes to `unsubscribed` only after the user submits the confirmation form with `POST`. Submitting the same email on the homepage restores it to `subscribed`.
